import Foundation
import Security

// Secrets travel through stdin/stdout pipes, never command arguments or logs.
let request = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [String: String]
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: request["service"]!,
    kSecAttrAccount as String: request["account"]!
]
if CommandLine.arguments.last == "add" {
    var item = query
    item[kSecValueData as String] = request["password"]!.data(using: .utf8)!
    let status = SecItemAdd(item as CFDictionary, nil)
    if status != errSecSuccess { fputs("Keychain write failed (\(status)).\n", stderr); exit(1) }
} else {
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(lookup as CFDictionary, &result)
    if status != errSecSuccess { fputs("Keychain read failed (\(status)).\n", stderr); exit(1) }
    FileHandle.standardOutput.write(result as! Data)
}
