import Foundation

// Mirrors backend/server.js's db.json shape — the same JSON the web app uses.

struct FullState: Codable {
    var members: [String]
    var boards: [Board]
    var manageclip: ManageclipState
    var vacation: VacationState?
}

// MARK: - Boards (Frieday)

struct Board: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var description: String?
    var columns: [Column]
    var groups: [BoardGroup]
}

struct Column: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var type: String // status | person | date | priority-ish status | text | number
    var labels: [StatusLabel]?
}

struct StatusLabel: Codable, Hashable {
    var label: String
    var color: String
}

struct BoardGroup: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var color: String
    var items: [BoardItem]
}

struct BoardItem: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var values: [String: String]
    var createdAt: String?

    enum CodingKeys: String, CodingKey { case id, name, values, createdAt }

    init(id: String, name: String, values: [String: String], createdAt: String? = nil) {
        self.id = id
        self.name = name
        self.values = values
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        // Cell values are strings from the web UI, but tolerate numbers.
        values = (try? c.decode([String: LenientString].self, forKey: .values))?
            .mapValues(\.value) ?? [:]
    }
}

/// Decodes a string, number, or bool into a String so one stray non-string
/// cell value can't sink the whole state decode.
struct LenientString: Codable, Hashable {
    let value: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { value = s }
        else if let i = try? c.decode(Int.self) { value = String(i) }
        else if let d = try? c.decode(Double.self) { value = String(d) }
        else if let b = try? c.decode(Bool.self) { value = String(b) }
        else { value = "" }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value)
    }
}

// MARK: - ManageClip (Shift HQ)

struct ManageclipState: Codable {
    var tasks: [ShiftTask]
    var logs: [ShiftLog]
    var links: [QuickLink]
    var settings: ShiftSettings

    static let empty = ManageclipState(tasks: [], logs: [], links: [], settings: ShiftSettings(weeklyTarget: 20))
}

struct ShiftTask: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var description: String
    var due_date: String // YYYY-MM-DD
    var status: String   // current | finished
    var category: String
}

struct ShiftLog: Codable, Identifiable, Hashable {
    var id: String
    var entry_date: String
    var content: String
    var category: String
}

struct QuickLink: Codable, Identifiable, Hashable {
    var id: String
    var url: String
    var display_mode: String
    var display_name: String
    var icon_reference: String?
}

struct ShiftSettings: Codable, Hashable {
    var weeklyTarget: Int?
}

// MARK: - Vacation Planner

struct VacationState: Codable {
    var operators: [Operator]
    var vacationBlocks: [VacationBlock]
    var demand: [String: [String: Double]] // process -> weekNumber(string) -> required
    var settings: VacationSettings
}

struct Operator: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var shift: String // S1 | S2
    var active: Bool
    var certifications: [String]
}

struct VacationBlock: Codable, Identifiable, Hashable {
    var id: String
    var operatorId: String
    var startWeek: Int
    var endWeek: Int
    var status: String // draft | pending | approved | requested
    var dayStatuses: [String: String]?
    var note: String?
}

struct VacationSettings: Codable, Hashable {
    var shiftMode: String // separate | combined | summer
    var visibleWeeks: Int
    var startWeek: Int
}

// MARK: - Helpers shared across views

enum TaskCategories {
    static let all = ["Gemba Walk", "Safety Audit", "Coaching", "Meeting", "Reporting", "Other"]
}

enum LogCategories {
    static let all = ["Safety", "Quality", "Delivery", "Cost", "People", "Other"]
}

extension ShiftTask {
    /// Same rule as the web tool: 'finished' sticks; unfinished past due is overdue.
    var effectiveStatus: String {
        if status == "finished" { return "finished" }
        return due_date < DateStrings.today() ? "overdue" : "current"
    }
}

enum DateStrings {
    static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    static func today() -> String { formatter.string(from: Date()) }

    static func isoWeek(_ date: Date = Date()) -> Int {
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = .current
        return cal.component(.weekOfYear, from: date)
    }
}
