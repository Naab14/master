import SwiftUI

struct ShiftsView: View {
    @EnvironmentObject var app: AppState
    @State private var mode: Mode = .tasks
    @State private var editingTask: ShiftTask?
    @State private var showNewTask = false

    enum Mode: String, CaseIterable {
        case tasks = "Tasks"
        case log = "Shift Log"
    }

    var body: some View {
        NavigationStack {
            Group {
                if let mc = app.state?.manageclip {
                    List {
                        if mode == .tasks {
                            taskSections(mc)
                        } else {
                            LogSection(logs: mc.logs)
                        }
                    }
                } else {
                    ContentUnavailableView("No connection", systemImage: "wifi.exclamationmark",
                                           description: Text("Check the server URL in Settings."))
                }
            }
            .navigationTitle("Shift HQ")
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: mode) { Haptics.selection() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Haptics.tap()
                        showNewTask = true
                    } label: {
                        Image(systemName: mode == .tasks ? "plus.circle.fill" : "square.and.pencil")
                    }
                }
            }
            .refreshable { await app.refresh() }
            .sheet(isPresented: $showNewTask) {
                if mode == .tasks {
                    TaskEditorSheet(task: nil)
                } else {
                    LogEntrySheet()
                }
            }
            .sheet(item: $editingTask) { task in
                TaskEditorSheet(task: task)
            }
        }
    }

    @ViewBuilder
    private func taskSections(_ mc: ManageclipState) -> some View {
        let today = DateStrings.today()
        let overdue = mc.tasks.filter { $0.effectiveStatus == "overdue" }.sorted { $0.due_date < $1.due_date }
        let dueToday = mc.tasks.filter { $0.due_date == today }.sorted { $0.title < $1.title }
        let upcoming = mc.tasks.filter { $0.due_date > today && $0.status != "finished" }.sorted { $0.due_date < $1.due_date }
        let recentDone = mc.tasks.filter { $0.status == "finished" && $0.due_date < today }.sorted { $0.due_date > $1.due_date }

        if !overdue.isEmpty {
            Section("Overdue") { ForEach(overdue) { row($0) } }
        }
        Section("Today") {
            if dueToday.isEmpty {
                Text("Nothing due today 🎉").foregroundStyle(.secondary)
            }
            ForEach(dueToday) { row($0) }
        }
        if !upcoming.isEmpty {
            Section("Upcoming") { ForEach(upcoming.prefix(15)) { row($0) } }
        }
        if !recentDone.isEmpty {
            Section("Recently completed") { ForEach(recentDone.prefix(10)) { row($0) } }
        }
    }

    private func row(_ task: ShiftTask) -> some View {
        let st = task.effectiveStatus
        return HStack(spacing: 12) {
            Button {
                app.toggleTask(task)
                if task.status == "finished" { Haptics.tap() } else { Haptics.success() }
            } label: {
                Image(systemName: st == "finished" ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(st == "finished" ? .green : st == "overdue" ? .red : .blue)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .strikethrough(st == "finished")
                    .foregroundStyle(st == "finished" ? .secondary : .primary)
                Text("\(task.due_date) · \(task.category)")
                    .font(.caption)
                    .foregroundStyle(st == "overdue" ? .red : .secondary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            Haptics.tap()
            editingTask = task
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Haptics.warning()
                app.deleteTask(task)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

// MARK: - Shift log

private struct LogSection: View {
    @EnvironmentObject var app: AppState
    let logs: [ShiftLog]

    var body: some View {
        Section("Recent entries") {
            if logs.isEmpty {
                Text("No entries yet — tap ✎ to log your first shift event.")
                    .foregroundStyle(.secondary)
            }
            ForEach(logs.prefix(30)) { log in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(log.category).font(.caption.bold())
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(.blue.opacity(0.15), in: Capsule())
                        Text(log.entry_date).font(.caption).foregroundStyle(.secondary)
                    }
                    Text(log.content).font(.subheadline)
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        Haptics.warning()
                        app.deleteLog(log)
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
    }
}

struct LogEntrySheet: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var category = "Safety"
    @State private var content = ""

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Picker("Category", selection: $category) {
                    ForEach(LogCategories.all, id: \.self) { Text($0) }
                }
                TextField("What happened on shift?", text: $content, axis: .vertical)
                    .lineLimit(3...6)
            }
            .navigationTitle("Log Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        app.addLog(date: DateStrings.formatter.string(from: date),
                                   category: category,
                                   content: content.trimmingCharacters(in: .whitespacesAndNewlines))
                        Haptics.success()
                        dismiss()
                    }
                    .disabled(content.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Task editor

struct TaskEditorSheet: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    let task: ShiftTask?
    @State private var title = ""
    @State private var details = ""
    @State private var due = Date()
    @State private var category = "Gemba Walk"
    @State private var finished = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("Description", text: $details, axis: .vertical).lineLimit(2...4)
                DatePicker("Due date", selection: $due, displayedComponents: .date)
                Picker("Category", selection: $category) {
                    ForEach(TaskCategories.all, id: \.self) { Text($0) }
                }
                Toggle("Completed", isOn: $finished)
                    .onChange(of: finished) { Haptics.selection() }

                if let task {
                    Button("Delete Task", role: .destructive) {
                        Haptics.warning()
                        app.deleteTask(task)
                        dismiss()
                    }
                }
            }
            .navigationTitle(task == nil ? "New Task" : "Edit Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        app.saveTask(ShiftTask(
                            id: task?.id ?? AppState.uid(),
                            title: title.trimmingCharacters(in: .whitespaces),
                            description: details.trimmingCharacters(in: .whitespaces),
                            due_date: DateStrings.formatter.string(from: due),
                            status: finished ? "finished" : "current",
                            category: category
                        ))
                        Haptics.success()
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let task {
                    title = task.title
                    details = task.description
                    due = DateStrings.formatter.date(from: task.due_date) ?? Date()
                    category = task.category
                    finished = task.status == "finished"
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
