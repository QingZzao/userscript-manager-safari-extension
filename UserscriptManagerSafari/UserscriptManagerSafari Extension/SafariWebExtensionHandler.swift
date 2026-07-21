//
//  SafariWebExtensionHandler.swift
//  UserScript Manager Safari Extension
//
//  Created by qingzzao on 2026/7/16.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let storagePrefix = "userscript-manager-native-storage:"

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        let response = NSExtensionItem()
        let responseMessage = handleNativeStorageMessage(message) ?? [ "echo": message as Any ]
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseMessage ]
        } else {
            response.userInfo = [ "message": responseMessage ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

    private func handleNativeStorageMessage(_ message: Any?) -> [String: Any]? {
        guard
            let dictionary = message as? [String: Any],
            dictionary["scope"] as? String == "userscript-manager-native-storage",
            let type = dictionary["type"] as? String,
            let key = dictionary["key"] as? String
        else {
            return nil
        }

        let defaults = UserDefaults.standard
        let defaultsKey = storagePrefix + key

        switch type {
        case "get":
            return [
                "ok": true,
                "value": defaults.object(forKey: defaultsKey) ?? NSNull()
            ]
        case "set":
            guard let value = dictionary["value"], JSONSerialization.isValidJSONObject(["value": value]) else {
                return [
                    "ok": false,
                    "error": "value is not JSON serializable"
                ]
            }
            defaults.set(value, forKey: defaultsKey)
            return [
                "ok": defaults.synchronize()
            ]
        case "remove":
            defaults.removeObject(forKey: defaultsKey)
            return [
                "ok": defaults.synchronize()
            ]
        default:
            return [
                "ok": false,
                "error": "Unknown native storage message type: \(type)"
            ]
        }
    }

}
