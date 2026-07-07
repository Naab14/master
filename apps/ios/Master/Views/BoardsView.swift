import SwiftUI

struct BoardsView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        NavigationStack {
            Group {
                if let boards = app.state?.boards {
                    List(boards) { board in
                        NavigationLink(value: board.id) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(board.name).font(.headline)
                                let items = board.groups.reduce(0) { $0 + $1.items.count }
                                Text("\(items) item\(items == 1 ? "" : "s") · \(board.groups.count) group\(board.groups.count == 1 ? "" : "s")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .navigationDestination(for: String.self) { boardId in
                        BoardDetailView(boardId: boardId)
                    }
                } else {
                    ContentUnavailableView("No connection", systemImage: "wifi.exclamationmark",
                                           description: Text("Check the server URL in Settings."))
                }
            }
            .navigationTitle("Boards")
            .refreshable { await app.refresh() }
        }
    }
}

struct BoardDetailView: View {
    @EnvironmentObject var app: AppState
    let boardId: String
    @State private var newItemNames: [String: String] = [:] // groupId -> draft

    private var board: Board? {
        app.state?.boards.first { $0.id == boardId }
    }

    var body: some View {
        Group {
            if let board {
                List {
                    ForEach(board.groups) { group in
                        Section {
                            ForEach(group.items) { item in
                                ItemRow(board: board, item: item, groupColor: group.color)
                            }
                            HStack {
                                Image(systemName: "plus")
                                    .foregroundStyle(.secondary)
                                TextField("Add item", text: binding(for: group.id))
                                    .onSubmit {
                                        let name = binding(for: group.id).wrappedValue.trimmingCharacters(in: .whitespaces)
                                        guard !name.isEmpty else { return }
                                        newItemNames[group.id] = ""
                                        Task { await app.addBoardItem(board: board, group: group, name: name) }
                                    }
                            }
                        } header: {
                            HStack(spacing: 6) {
                                Circle().fill(Color(hex: group.color)).frame(width: 9, height: 9)
                                Text(group.title)
                                Text("· \(group.items.count)").foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .navigationTitle(board.name)
                .navigationBarTitleDisplayMode(.inline)
                .refreshable { await app.refresh() }
            } else {
                ProgressView()
            }
        }
    }

    private func binding(for groupId: String) -> Binding<String> {
        Binding(
            get: { newItemNames[groupId] ?? "" },
            set: { newItemNames[groupId] = $0 }
        )
    }
}

private struct ItemRow: View {
    @EnvironmentObject var app: AppState
    let board: Board
    let item: BoardItem
    let groupColor: String

    private var statusColumns: [Column] { board.columns.filter { $0.type == "status" } }
    private var personCol: Column? { board.columns.first { $0.type == "person" } }
    private var dateCol: Column? { board.columns.first { $0.type == "date" } }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color(hex: groupColor))
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 5) {
                Text(item.name).font(.subheadline)

                HStack(spacing: 6) {
                    // One tappable chip per status-type column (Status, Priority, …)
                    ForEach(statusColumns) { col in
                        statusChip(col)
                    }
                    if let owner = personCol.flatMap({ item.values[$0.id] }), !owner.isEmpty {
                        Text(owner)
                            .font(.caption2)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(.blue.opacity(0.15), in: Capsule())
                    }
                    if let due = dateCol.flatMap({ item.values[$0.id] }), !due.isEmpty {
                        Text(due).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Haptics.warning()
                app.deleteBoardItem(board: board, item: item)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func statusChip(_ col: Column) -> some View {
        let value = item.values[col.id] ?? ""
        let def = col.labels?.first { $0.label == value }
        return Menu {
            ForEach(col.labels ?? [], id: \.label) { label in
                Button(label.label) {
                    Haptics.selection()
                    app.setItemValue(board: board, item: item, columnId: col.id, value: label.label)
                }
            }
            Button("Clear", role: .destructive) {
                Haptics.tap()
                app.setItemValue(board: board, item: item, columnId: col.id, value: "")
            }
        } label: {
            Text(value.isEmpty ? col.title : value)
                .font(.caption2.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Color(hex: def?.color ?? "#c4c4c4"), in: Capsule())
        }
    }
}

// MARK: - Hex colors (board group/status colors come from the API as #rrggbb)

extension Color {
    init(hex: String) {
        var value: UInt64 = 0
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        Scanner(string: cleaned).scanHexInt64(&value)
        let r, g, b: Double
        if cleaned.count == 6 {
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
        } else {
            r = 0.5; g = 0.5; b = 0.5
        }
        self.init(red: r, green: g, blue: b)
    }
}
