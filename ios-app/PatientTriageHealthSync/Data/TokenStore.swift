import Foundation
import Security

/// Keychain-backed storage for the JWT and the sync high-water mark — the
/// iOS equivalent of Android's EncryptedSharedPreferences-backed
/// TokenStore.kt. The Keychain is the standard place to store secrets on
/// iOS; never UserDefaults, which is unencrypted plist storage.
final class TokenStore {
    private let service = "com.patienttriage.healthsync"
    private let tokenAccount = "auth_token"
    private let lastSyncedAccount = "last_synced_at"

    var token: String? {
        get { read(account: tokenAccount) }
        set {
            if let newValue {
                write(account: tokenAccount, value: newValue)
            } else {
                delete(account: tokenAccount)
            }
        }
    }

    /// Last successful sync time, ISO-8601 UTC. Nil means "never synced —
    /// read a default lookback window instead." Only advanced after a sync
    /// actually succeeds, so a failed POST never silently drops readings.
    var lastSyncedAt: String? {
        get { read(account: lastSyncedAccount) }
        set {
            if let newValue {
                write(account: lastSyncedAccount, value: newValue)
            } else {
                delete(account: lastSyncedAccount)
            }
        }
    }

    func clear() {
        delete(account: tokenAccount)
        delete(account: lastSyncedAccount)
    }

    private func read(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func write(account: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [kSecValueData as String: data]

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecSuccess {
            SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        } else {
            var newItem = query
            newItem[kSecValueData as String] = data
            newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(newItem as CFDictionary, nil)
        }
    }

    private func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
