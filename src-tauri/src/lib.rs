use std::sync::Mutex;
use sysinfo::{get_current_pid, ProcessesToUpdate, System};
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

struct SystemState {
    sys: Mutex<System>,
}

#[tauri::command]
fn get_memory_usage(state: tauri::State<'_, SystemState>) -> Result<u64, String> {
    let mut sys = state.sys.lock().map_err(|e| e.to_string())?;

    // Get current process ID
    let pid = get_current_pid().map_err(|e| e.to_string())?;

    // Refresh only the current process memory
    sys.refresh_processes(ProcessesToUpdate::Some(&[pid]));

    // Extract app memory
    let app_memory = sys.process(pid).map(|p| p.memory()).unwrap_or(0);

    Ok(app_memory)
}

#[tauri::command]
fn open_instances_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("instances") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let _window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "instances",
        tauri::WebviewUrl::App("instances".into()),
    )
    .title("Your Instances")
    .inner_size(600.0, 500.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        // .plugin(tauri_plugin_drpc::init())
        .manage(SystemState {
            sys: Mutex::new(System::new()),
        })
        .plugin(tauri_plugin_svelte::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_macos_fps::init())
        // .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_memory_usage, open_instances_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
