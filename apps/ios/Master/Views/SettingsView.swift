import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var app: AppState
    @State private var urlDraft = ""
    @State private var codeDraft = ""
    @State private var testResult: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://your-app.vercel.app", text: $urlDraft)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Access code", text: $codeDraft)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Save & Test") {
                        Haptics.tap()
                        // Set the code first: changing serverURL triggers a refresh.
                        app.accessCode = codeDraft.trimmingCharacters(in: .whitespaces)
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
                    Text("Your Vercel address (e.g. https://your-app.vercel.app) and the access code set in Vercel. For a self-hosted server on the same Wi-Fi, use your computer's LAN IP, e.g. http://192.168.1.20:3000.")
                }

                Section("About") {
                    LabeledContent("App", value: "Master")
                    LabeledContent("Modules", value: "Shift HQ · Vacations · Boards")
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                urlDraft = app.serverURL
                codeDraft = app.accessCode
            }
        }
    }
}
