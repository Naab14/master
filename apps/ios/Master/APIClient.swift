import Foundation

/// Thin async client for the Master backend (backend/server.js) — the same
/// JSON REST API the web app talks to.
struct APIClient {
    var baseURL: URL

    init(baseURLString: String) {
        baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines))
            ?? URL(string: "http://localhost:3000")!
    }

    enum APIError: LocalizedError {
        case http(Int)
        case badURL

        var errorDescription: String? {
            switch self {
            case .http(let code): return "Server error (HTTP \(code))"
            case .badURL: return "Invalid server URL"
            }
        }
    }

    /// Request with no request body (GET/DELETE).
    private func request(_ path: String, method: String = "GET") async throws -> Data {
        try await send(path, method: method, httpBody: nil)
    }

    /// Request that encodes `body` as JSON (POST/PUT/PATCH).
    private func request<Body: Encodable>(_ path: String, method: String, body: Body) async throws -> Data {
        try await send(path, method: method, httpBody: try JSONEncoder().encode(body))
    }

    private func send(_ path: String, method: String, httpBody: Data?) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.badURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 10
        if let httpBody {
            req.httpBody = httpBody
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.http(http.statusCode)
        }
        return data
    }

    // MARK: Full state

    func fullState() async throws -> FullState {
        try JSONDecoder().decode(FullState.self, from: await request("/api/state"))
    }

    // MARK: ManageClip

    @discardableResult
    func putManageclip(_ state: ManageclipState) async throws -> Data {
        try await request("/api/manageclip/state", method: "PUT", body: state)
    }

    // MARK: Vacation

    @discardableResult
    func putVacation(_ state: VacationState) async throws -> Data {
        try await request("/api/vacation/state", method: "PUT", body: state)
    }

    // MARK: Boards

    private struct ValuesPatch: Encodable { let values: [String: String] }
    private struct NamePatch: Encodable { let name: String }

    @discardableResult
    func setItemValues(boardId: String, itemId: String, values: [String: String]) async throws -> Data {
        try await request("/api/boards/\(boardId)/items/\(itemId)", method: "PATCH", body: ValuesPatch(values: values))
    }

    func addItem(boardId: String, groupId: String, name: String) async throws -> BoardItem {
        let data = try await request("/api/boards/\(boardId)/groups/\(groupId)/items", method: "POST", body: NamePatch(name: name))
        return try JSONDecoder().decode(BoardItem.self, from: data)
    }

    @discardableResult
    func deleteItem(boardId: String, itemId: String) async throws -> Data {
        try await request("/api/boards/\(boardId)/items/\(itemId)", method: "DELETE")
    }

    func addBoard(name: String) async throws -> Board {
        let data = try await request("/api/boards", method: "POST", body: NamePatch(name: name))
        return try JSONDecoder().decode(Board.self, from: data)
    }
}
