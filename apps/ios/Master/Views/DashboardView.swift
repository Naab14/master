import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let error = app.errorMessage {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    }

                    if let state = app.state {
                        shiftCard(state.manageclip)
                        vacationCard(state.vacation)
                        boardsCard(state.boards)
                    } else if app.isLoading {
                        ProgressView("Connecting to your Master server…")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 80)
                    }
                }
                .padding()
            }
            .navigationTitle("Week \(DateStrings.isoWeek())")
            .refreshable {
                await app.refresh()
                if app.errorMessage == nil { Haptics.success() } else { Haptics.error() }
            }
        }
    }

    // MARK: Shift HQ card

    private func shiftCard(_ mc: ManageclipState) -> some View {
        let today = DateStrings.today()
        let dueToday = mc.tasks.filter { $0.due_date == today && $0.status != "finished" }
        let doneToday = mc.tasks.filter { $0.due_date == today && $0.status == "finished" }
        let overdue = mc.tasks.filter { $0.effectiveStatus == "overdue" }

        return Card(title: "Shift HQ", subtitle: "Today on shift") {
            HStack(spacing: 10) {
                Stat(value: "\(dueToday.count)", label: "Due today", tint: .blue)
                Stat(value: "\(doneToday.count)", label: "Done", tint: .green)
                Stat(value: "\(overdue.count)", label: "Overdue", tint: overdue.isEmpty ? .secondary : .red)
            }
            ForEach(dueToday.prefix(4)) { task in
                Label(task.title, systemImage: "circle")
                    .font(.subheadline)
                    .lineLimit(1)
            }
            if dueToday.isEmpty {
                Text("Nothing due today 🎉")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Vacation card

    @ViewBuilder
    private func vacationCard(_ vac: VacationState?) -> some View {
        Card(title: "Vacations", subtitle: "Coverage · week \(DateStrings.isoWeek())") {
            if let vac {
                let s = Coverage.summary(vac, week: DateStrings.isoWeek())
                HStack(spacing: 8) {
                    Circle().fill(s.worst.color).frame(width: 12, height: 12)
                    Text(s.worst == .green ? "All processes covered"
                         : s.worst == .yellow ? "Coverage tight" : "Coverage gap!")
                        .font(.subheadline.bold())
                }
                Text(s.out.isEmpty
                     ? "Nobody on vacation this week."
                     : "Out: " + s.out.map { $0.name.components(separatedBy: " ").first ?? $0.name }.joined(separator: ", "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                Text("Open the vacation planner on the web once to set up the workspace.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Boards card

    private func boardsCard(_ boards: [Board]) -> some View {
        var counts: [(String, Int)] = []
        var total = 0
        var byLabel: [String: Int] = [:]
        for board in boards {
            let statusCol = board.columns.first { $0.type == "status" }
            for group in board.groups {
                for item in group.items {
                    total += 1
                    let label = statusCol.flatMap { item.values[$0.id] }.flatMap { $0.isEmpty ? nil : $0 } ?? "No status"
                    byLabel[label, default: 0] += 1
                }
            }
        }
        counts = byLabel.sorted { $0.value > $1.value }.map { ($0.key, $0.value) }

        return Card(title: "Boards", subtitle: "\(total) items · \(boards.count) board\(boards.count == 1 ? "" : "s")") {
            ForEach(counts.prefix(5), id: \.0) { label, n in
                HStack {
                    Text(label).font(.subheadline)
                    Spacer()
                    Text("\(n)").font(.subheadline.bold())
                }
            }
            if counts.isEmpty {
                Text("No boards yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Card chrome

struct Card<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct Stat: View {
    let value: String
    let label: String
    var tint: Color = .primary

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title2.bold()).foregroundStyle(tint)
            Text(label.uppercased()).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }
}
