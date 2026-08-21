import SwiftUI

/// Logs in against the same /api/auth/login the web app and the Android
/// companion app use — this app has no auth system of its own, it reuses
/// the patient account you already have. Ingest specifically requires a
/// PATIENT-role account (see backend/src/routes/health-data.routes.ts);
/// logging in with a staff/admin account authenticates fine here but fails
/// later with a clear error when a sync is attempted.
struct LoginView: View {
    let apiClient: ApiClient
    let onLoginSuccess: (String) -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        VStack(spacing: 16) {
            Text("Patient Triage — Health Sync")
                .font(.title2)
                .bold()

            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            if let error {
                Text(error)
                    .foregroundColor(.red)
                    .font(.footnote)
            }

            Button {
                signIn()
            } label: {
                if loading {
                    ProgressView()
                } else {
                    Text("Sign in")
                }
            }
            .disabled(loading || email.isEmpty || password.isEmpty)
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private func signIn() {
        error = nil
        loading = true
        Task {
            do {
                let result = try await apiClient.login(email: email.trimmingCharacters(in: .whitespaces), password: password)
                loading = false
                onLoginSuccess(result.token)
            } catch let apiError as ApiError {
                loading = false
                error = apiError.message
            } catch {
                loading = false
                self.error = "Couldn't reach the server. Check your connection."
            }
        }
    }
}
