import UIKit

/// One place for every buzz in the app, so feedback stays consistent:
/// - `tap` for light interactions (toggles, navigation into detail)
/// - `selection` for scrubbing through options (status menus, pickers)
/// - `success` / `warning` / `error` for outcomes (saved, approved, failed)
/// Views can also use SwiftUI's `.sensoryFeedback` where it reads better;
/// both routes go through the same Taptic Engine.
enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let selectionGen = UISelectionFeedbackGenerator()
    private static let notification = UINotificationFeedbackGenerator()

    static func tap() { light.impactOccurred() }
    static func thud() { medium.impactOccurred() }
    static func selection() { selectionGen.selectionChanged() }
    static func success() { notification.notificationOccurred(.success) }
    static func warning() { notification.notificationOccurred(.warning) }
    static func error() { notification.notificationOccurred(.error) }
}
