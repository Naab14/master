import SwiftUI

@main
struct MasterApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }
            ShiftsView()
                .tabItem { Label("Shift HQ", systemImage: "calendar.badge.checkmark") }
            VacationView()
                .tabItem { Label("Vacations", systemImage: "sun.max") }
            BoardsView()
                .tabItem { Label("Boards", systemImage: "tablecells") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .task { await app.refresh() }
    }
}
