import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var app: AppState
    @State private var urlDraft = ""
    @State private var testResult: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("http://192.168.1.20:3000", text: $urlDraft)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Save & Test") {
                        Haptics.tap()
                        app.serverURL = urlDraft.trimmingCharacters(in: .whitespaces)
                        Task {
                            await app.refresh()
                            if app.errorMessage == nil {
                                testResult = "Connected ✓"
                                Haptics.success()
                            } else {
                                testResult = app.errorMessage
                                Haptics.error()
                            }
                        }
                    }
                    if let testResult {
                        Text(testResult)
                            .font(.footnote)
                            .foregroundStyle(testResult.hasPrefix("Connected") ? .green : .red)
                    }
                } header: {
                    Text("Master server")
                } footer: {
                    Text("The address of your self-hosted Master backend (node backend/server.js). On the same Wi-Fi, use your computer's LAN IP, e.g. http://192.168.1.20:3000.")
                }

                Section("About") {
                    LabeledContent("App", value: "Master")
                    LabeledContent("Modules", value: "Shift HQ · Vacations · Boards")
                }
            }
            .navigationTitle("Settings")
            .onAppear { urlDraft = app.serverURL }
        }
    }
}
