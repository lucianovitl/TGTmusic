use crate::{
    models::Track,
    services::audio_engine::ENGINE,
    utils::{Error, Result},
};
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn play_track(track: Track) -> Result<()> {
    ENGINE.play(track).await
}

/// Global shortcut: Play/Pause toggle
#[tauri::command]
pub async fn global_play_pause(app: AppHandle) -> Result<()> {
    let _ = app.emit("tray-play-pause", ());
    Ok(())
}

/// Global shortcut: Next track
#[tauri::command]
pub async fn global_next(app: AppHandle) -> Result<()> {
    let _ = app.emit("tray-next", ());
    Ok(())
}

/// Global shortcut: Previous track
#[tauri::command]
pub async fn global_prev(app: AppHandle) -> Result<()> {
    let _ = app.emit("tray-prev", ());
    Ok(())
}

#[tauri::command]
pub async fn pause() -> Result<()> {
    ENGINE.pause().await
}

#[tauri::command]
pub async fn resume() -> Result<()> {
    ENGINE.resume().await
}

#[tauri::command]
pub async fn stop() -> Result<()> {
    ENGINE.stop().await
}

#[tauri::command]
pub async fn seek(position: f64) -> Result<()> {
    let position = validate_seek_position(position)?;
    ENGINE.seek(position).await
}

#[tauri::command]
pub async fn set_volume(volume: f32) -> Result<()> {
    let volume = validate_volume(volume)?;
    ENGINE.set_volume(volume).await
}

fn validate_seek_position(position: f64) -> Result<f64> {
    if !position.is_finite() || position < 0.0 {
        return Err(Error::Config(
            "seek position must be a finite non-negative number".into(),
        ));
    }
    Ok(position)
}

fn validate_volume(volume: f32) -> Result<f32> {
    if !volume.is_finite() {
        return Err(Error::Config("volume must be a finite number".into()));
    }
    Ok(volume.clamp(0.0, 1.0))
}

#[cfg(test)]
mod tests {
    use super::{validate_seek_position, validate_volume};

    #[test]
    fn seek_position_rejects_negative_and_non_finite_values() {
        assert!(validate_seek_position(-1.0).is_err());
        assert!(validate_seek_position(f64::NAN).is_err());
        assert!(validate_seek_position(f64::INFINITY).is_err());
    }

    #[test]
    fn seek_position_accepts_zero_and_positive_values() {
        assert_eq!(validate_seek_position(0.0).unwrap(), 0.0);
        assert_eq!(validate_seek_position(15.5).unwrap(), 15.5);
    }

    #[test]
    fn volume_rejects_non_finite_values_and_clamps_finite_values() {
        assert!(validate_volume(f32::NAN).is_err());
        assert!(validate_volume(f32::INFINITY).is_err());
        assert_eq!(validate_volume(-0.5).unwrap(), 0.0);
        assert_eq!(validate_volume(0.8).unwrap(), 0.8);
        assert_eq!(validate_volume(1.5).unwrap(), 1.0);
    }
}
