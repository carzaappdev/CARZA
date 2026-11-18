import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SafeAreaContainer()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/**
 * Hosts the Capacitor web view inside the safe area, so the site's header and bottom tabs sit clear of
 * the status bar, Dynamic Island and home indicator exactly as they do in Safari. The strips around it
 * use the site's own page colors for light and dark mode.
 */
final class SafeAreaContainer: UIViewController {
    private let bridgeController = CAPBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 9 / 255, green: 13 / 255, blue: 20 / 255, alpha: 1)
                : .white
        }
        addChild(bridgeController)
        bridgeController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeController.view)
        NSLayoutConstraint.activate([
            bridgeController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bridgeController.view.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bridgeController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }

    override var childForStatusBarStyle: UIViewController? { bridgeController }
}
