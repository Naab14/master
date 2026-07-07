import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @AppStorage("serverURL") var serverURL: String = "http://localhost:3000" {
        didSet { Task { await refresh() } }
    }

    @Published var state: FullState?
    @Published var isLoading = false
    @Published var errorMessage: String?

    var api: APIClient { APIClient(baseURLString: serverURL) }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            state = try await api.fullState()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Shift HQ mutations (whole-state PUT, like the web tool)

    private func pushManageclip() {
        guard let mc = state?.manageclip else { return }
        Task { try? await api.putManageclip(mc) }
    }

    func toggleTask(_ task: ShiftTask) {
        guard var mc = state?.manageclip,
              let i = mc.tasks.firstIndex(where: { $0.id == task.id }) else { return }
        mc.tasks[i].status = mc.tasks[i].status == "finished" ? "current" : "finished"
        state?.manageclip = mc
        pushManageclip()
    }

    func saveTask(_ task: ShiftTask) {
        guard var mc = state?.manageclip else { return }
        if let i = mc.tasks.firstIndex(where: { $0.id == task.id }) {
            mc.tasks[i] = task
        } else {
            mc.tasks.append(task)
        }
        state?.manageclip = mc
        pushManageclip()
    }

    func deleteTask(_ task: ShiftTask) {
        guard var mc = state?.manageclip else { return }
        mc.tasks.removeAll { $0.id == task.id }
        state?.manageclip = mc
        pushManageclip()
    }

    func addLog(date: String, category: String, content: String) {
        guard var mc = state?.manageclip else { return }
        let log = ShiftLog(id: Self.uid(), entry_date: date, content: content, category: category)
        mc.logs.insert(log, at: 0)
        state?.manageclip = mc
        pushManageclip()
    }

    func deleteLog(_ log: ShiftLog) {
        guard var mc = state?.manageclip else { return }
        mc.logs.removeAll { $0.id == log.id }
        state?.manageclip = mc
        pushManageclip()
    }

    // MARK: - Vacation mutations

    func setBlockStatus(_ block: VacationBlock, status: String) {
        guard var vac = state?.vacation,
              let i = vac.vacationBlocks.firstIndex(where: { $0.id == block.id }) else { return }
        vac.vacationBlocks[i].status = status
        state?.vacation = vac
        Task { try? await api.putVacation(vac) }
    }

    // MARK: - Board mutations (granular API, optimistic local update)

    func setItemValue(board: Board, item: BoardItem, columnId: String, value: String) {
        mutateItem(boardId: board.id, itemId: item.id) { $0.values[columnId] = value }
        Task { try? await api.setItemValues(boardId: board.id, itemId: item.id, values: [columnId: value]) }
    }

    func addBoardItem(board: Board, group: BoardGroup, name: String) async {
        guard let created = try? await api.addItem(boardId: board.id, groupId: group.id, name: name) else {
            Haptics.error()
            return
        }
        guard let bi = state?.boards.firstIndex(where: { $0.id == board.id }),
              let gi = state?.boards[bi].groups.firstIndex(where: { $0.id == group.id }) else { return }
        state?.boards[bi].groups[gi].items.append(created)
        Haptics.success()
    }

    func deleteBoardItem(board: Board, item: BoardItem) {
        guard let bi = state?.boards.firstIndex(where: { $0.id == board.id }) else { return }
        for gi in state!.boards[bi].groups.indices {
            state!.boards[bi].groups[gi].items.removeAll { $0.id == item.id }
        }
        Task { try? await api.deleteItem(boardId: board.id, itemId: item.id) }
    }

    private func mutateItem(boardId: String, itemId: String, _ change: (inout BoardItem) -> Void) {
        guard let bi = state?.boards.firstIndex(where: { $0.id == boardId }) else { return }
        for gi in state!.boards[bi].groups.indices {
            if let ii = state!.boards[bi].groups[gi].items.firstIndex(where: { $0.id == itemId }) {
                change(&state!.boards[bi].groups[gi].items[ii])
                return
            }
        }
    }

    static func uid() -> String {
        UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased().prefix(12).description
    }
}

// MARK: - Coverage (port of apps/web/src/tools/vacation/coverage.js)

enum CoverageLevel: Int, Comparable {
    case green = 0, yellow = 1, red = 2
    static func < (a: CoverageLevel, b: CoverageLevel) -> Bool { a.rawValue < b.rawValue }

    var color: Color {
        switch self {
        case .green: return .green
        case .yellow: return .yellow
        case .red: return .red
        }
    }
}

struct ProcessCoverage {
    var required: Int
    var covered: Int
    var out: [Operator]
    var level: CoverageLevel {
        if covered >= required { return .green }
        if covered >= required - 1 { return .yellow }
        return .red
    }
}

enum Coverage {
    static let processes = [
        "Avsyning",
        "Kapselresaren",
        "Serialisering",
        "Etikettering",
        "Granskning/uttag av dok",
    ]

    /// Same two-pass assignment as the web tool: single-certified operators
    /// first, then multi-certified operators to the neediest process.
    static func forWeek(_ vac: VacationState, week: Int, shiftFilter: String?) -> [String: ProcessCoverage] {
        var map: [String: ProcessCoverage] = [:]
        for proc in processes {
            let required = vac.demand[proc]?[String(week)] ?? 2
            map[proc] = ProcessCoverage(required: Int(required), covered: 0, out: [])
        }

        let eligible = vac.operators.filter { op in
            guard op.active, !op.certifications.isEmpty else { return false }
            if vac.settings.shiftMode == "separate", let f = shiftFilter, op.shift != f { return false }
            return true
        }

        var activeOps: [Operator] = []
        for op in eligible {
            let onVacation = vac.vacationBlocks.contains {
                $0.operatorId == op.id && $0.status == "approved" && week >= $0.startWeek && week <= $0.endWeek
            }
            if onVacation {
                for cert in op.certifications where map[cert] != nil {
                    map[cert]!.out.append(op)
                }
            } else {
                activeOps.append(op)
            }
        }

        var multiCerts: [Operator] = []
        for op in activeOps {
            if op.certifications.count == 1, let proc = op.certifications.first, map[proc] != nil {
                map[proc]!.covered += 1
            } else {
                multiCerts.append(op)
            }
        }

        for op in multiCerts {
            var neediest: String?
            var lowestRatio = Double.infinity
            for proc in op.certifications {
                guard let cov = map[proc] else { continue }
                let ratio = cov.required > 0 ? Double(cov.covered) / Double(cov.required) : .infinity
                if ratio < lowestRatio {
                    lowestRatio = ratio
                    neediest = proc
                }
            }
            if let proc = neediest { map[proc]!.covered += 1 }
        }

        return map
    }

    /// Worst level across all processes (and both shifts in 'separate' mode).
    static func summary(_ vac: VacationState, week: Int) -> (worst: CoverageLevel, perProcess: [String: CoverageLevel], out: [Operator]) {
        let shifts: [String?] = vac.settings.shiftMode == "separate" ? ["S1", "S2"] : [nil]
        var worst = CoverageLevel.green
        var per: [String: CoverageLevel] = [:]
        for shift in shifts {
            let cov = forWeek(vac, week: week, shiftFilter: shift)
            for (proc, c) in cov {
                worst = max(worst, c.level)
                per[proc] = max(per[proc] ?? .green, c.level)
            }
        }
        let out = vac.operators.filter { op in
            vac.vacationBlocks.contains {
                $0.operatorId == op.id && $0.status == "approved" && week >= $0.startWeek && week <= $0.endWeek
            }
        }
        return (worst, per, out)
    }
}
