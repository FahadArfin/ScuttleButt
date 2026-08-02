use serde::Serialize;
use serde_json::Value;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};

#[cfg(debug_assertions)]
const KEYRING_SERVICE: &str = "app.scuttlebutt.desktop.dev";
#[cfg(not(debug_assertions))]
const KEYRING_SERVICE: &str = "app.scuttlebutt.desktop";
const KEYRING_ACCOUNT: &str = "matrix-session";
const PUSH_TO_TALK_ACCELERATOR: &str = "CommandOrControl+Shift+Space";
const MAX_SESSION_BYTES: usize = 32 * 1024;
const MAX_NOTIFICATION_TITLE_BYTES: usize = 120;
const MAX_NOTIFICATION_BODY_BYTES: usize = 500;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopDiagnostics {
    runtime: &'static str,
    secure_storage: &'static str,
    notifications: bool,
    global_shortcut: bool,
    deep_links: bool,
    media_devices: bool,
    platform: &'static str,
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|error| format!("Secure storage could not be opened: {error}"))
}

fn validate_session_payload(session: &str) -> Result<(), String> {
    if session.is_empty() || session.len() > MAX_SESSION_BYTES {
        return Err("The desktop session payload has an invalid size.".to_owned());
    }

    let value: Value = serde_json::from_str(session)
        .map_err(|_| "The desktop session payload is not valid JSON.".to_owned())?;
    let object = value
        .as_object()
        .ok_or_else(|| "The desktop session payload must be an object.".to_owned())?;

    for field in ["homeserverUrl", "accessToken", "userId", "deviceId"] {
        let is_non_empty_text = object
            .get(field)
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty());
        if !is_non_empty_text {
            return Err(format!("The desktop session field `{field}` is required."));
        }
    }

    let homeserver_url = object
        .get("homeserverUrl")
        .and_then(Value::as_str)
        .expect("homeserverUrl was validated above");
    if !(homeserver_url.starts_with("http://") || homeserver_url.starts_with("https://")) {
        return Err("The homeserver URL must use HTTP or HTTPS.".to_owned());
    }

    Ok(())
}

#[tauri::command]
fn store_session(session: String) -> Result<(), String> {
    validate_session_payload(&session)?;
    keyring_entry()?
        .set_password(&session)
        .map_err(|error| format!("Secure session storage failed: {error}"))
}

#[tauri::command]
fn load_session() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(session) => {
            validate_session_payload(&session)?;
            Ok(Some(session))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Secure session retrieval failed: {error}")),
    }
}

#[tauri::command]
fn clear_session() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Secure session deletion failed: {error}")),
    }
}

#[tauri::command]
fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    if title.is_empty() || title.len() > MAX_NOTIFICATION_TITLE_BYTES {
        return Err("The notification title has an invalid size.".to_owned());
    }
    if body.is_empty() || body.len() > MAX_NOTIFICATION_BODY_BYTES {
        return Err("The notification body has an invalid size.".to_owned());
    }

    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| format!("Desktop notification failed: {error}"))
}

#[cfg(target_os = "macos")]
fn push_to_talk_shortcut() -> tauri_plugin_global_shortcut::Shortcut {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

#[cfg(not(target_os = "macos"))]
fn push_to_talk_shortcut() -> tauri_plugin_global_shortcut::Shortcut {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

#[tauri::command]
fn set_push_to_talk_enabled(
    app: tauri::AppHandle,
    enabled: bool,
    accelerator: String,
) -> Result<(), String> {
    if accelerator != PUSH_TO_TALK_ACCELERATOR {
        return Err("Only the approved push-to-talk accelerator may be registered.".to_owned());
    }

    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    let shortcut = push_to_talk_shortcut();
    if enabled {
        app.global_shortcut()
            .register(shortcut)
            .map_err(|error| format!("Push-to-talk registration failed: {error}"))
    } else {
        app.global_shortcut()
            .unregister(shortcut)
            .map_err(|error| format!("Push-to-talk removal failed: {error}"))
    }
}

#[tauri::command]
fn desktop_diagnostics() -> DesktopDiagnostics {
    DesktopDiagnostics {
        runtime: "desktop",
        secure_storage: "os-keychain",
        notifications: true,
        global_shortcut: true,
        deep_links: true,
        media_devices: true,
        platform: std::env::consts::OS,
    }
}

fn configure_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Scuttlebutt", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if shortcut == &push_to_talk_shortcut() {
                        let pressed = matches!(
                            event.state(),
                            tauri_plugin_global_shortcut::ShortcutState::Pressed
                        );
                        let _ = app.emit("desktop://push-to-talk", pressed);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            store_session,
            load_session,
            clear_session,
            send_notification,
            set_push_to_talk_enabled,
            desktop_diagnostics
        ])
        .setup(|app| {
            configure_tray(app)?;

            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Scuttlebutt desktop application");
}
