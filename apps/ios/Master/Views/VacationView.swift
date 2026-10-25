import SwiftUI

struct VacationView: View {
    @EnvironmentObject var app: AppState
    @State private var week = DateStrings.isoWeek()

    var body: some View {
        NavigationStack {
            Group {
                if let vac = app.state?.vacation {
                    List {
                        coverageSection(vac)
                        outSection(vac)
                        pendingSection(vac)
                        rosterSection(vac)
                    }
                } else {
                    ContentUnavailableView(
                        "Not set up yet",
                        systemImage: "sun.max",
                        description: Text("Open the Vacations tab in the web app once to seed the workspace — it syncs here automatically.")
                    )
                }
            }
            .navigationTitle("Vacations")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Stepper("Week \(week)", value: $week, in: 1...52)
                        .onChange(of: week) { Haptics.selection() }
                }
            }
            .refreshable { await app.refresh() }
        }
    }

    private func coverageSection(_ vac: VacationState) -> some View {
        Section("Coverage · week \(week)") {
            let summary = Coverage.summary(vac, week: week)
            HStack(spacing: 8) {
                Circle().fill(summary.worst.color).frame(width: 12, height: 12)
                Text(summary.worst == .green ? "All processes covered"
                     : summary.worst == .yellow ? "Coverage tight" : "Coverage gap!")
                    .font(.subheadline.bold())
            }
            ForEach(Coverage.processes, id: \.self) { proc in
                if let level = summary.perProcess[proc] {
                    HStack {
                        Text(proc).font(.subheadline)
                        Spacer()
                        Circle().fill(level.color).frame(width: 10, height: 10)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func outSection(_ vac: VacationState) -> some View {
        let out = vac.operators.filter { op in
            vac.vacationBlocks.contains {
                $0.operatorId == op.id && $0.status == "approved" && week >= $0.startWeek && week <= $0.endWeek
            }
        }
        if !out.isEmpty {
            Section("Out week \(week)") {
                ForEach(out) { op in
                    Label("\(op.name) · \(op.shift)", systemImage: "airplane.departure")
                        .font(.subheadline)
                }
            }
        }
    }

    @ViewBuilder
    private func pendingSection(_ vac: VacationState) -> some View {
        let pending = vac.vacationBlocks.filter { $0.status == "pending" || $0.status == "requested" }
        if !pending.isEmpty {
            Section("Awaiting approval") {
                ForEach(pending) { block in
                    let op = vac.operators.first { $0.id == block.operatorId }
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(op?.name ?? "Unknown").font(.subheadline.bold())
                            Text("v.\(block.startWeek)–\(block.endWeek) · \(block.status)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Approve") {
                            app.setBlockStatus(block, status: "approved")
                            Haptics.success()
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                    }
                }
            }
        }
    }

    private func rosterSection(_ vac: VacationState) -> some View {
        Section("Operators") {
            ForEach(vac.operators.filter(\.active)) { op in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(op.name).font(.subheadline)
                        Spacer()
                        Text(op.shift)
                            .font(.caption.bold())
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(.blue.opacity(0.15), in: Capsule())
                    }
                    Text(op.certifications.joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
