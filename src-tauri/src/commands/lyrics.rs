use crate::utils::Result;
use reqwest::Client;

#[tauri::command]
pub async fn fetch_lyrics(title: String, artist: String) -> Result<Option<serde_json::Value>> {
    let client = Client::new();
    let query = format!("{} {}", title, artist);
    let url = format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(&query)
    );
    let resp = client.get(&url).send().await?;
    let data: serde_json::Value = resp.json().await?;
    if let Some(arr) = data.as_array() {
        if let Some(first) = arr.first() {
            let synced = first["syncedLyrics"].as_str().unwrap_or("");
            let plain = first["plainLyrics"].as_str().unwrap_or("");
            let lines: Vec<_> = synced
                .lines()
                .filter_map(|l| {
                    if let Some(end) = l.find(']') {
                        let time_str = &l[1..end];
                        let parts: Vec<&str> = time_str.split(':').collect();
                        if parts.len() == 2 {
                            let min = parts[0].parse::<f64>().ok()?;
                            let sec = parts[1].parse::<f64>().ok()?;
                            let time = min * 60.0 + sec;
                            return Some(
                                serde_json::json!({ "time": time, "text": &l[end+1..].trim() }),
                            );
                        }
                    }
                    None
                })
                .collect();
            return Ok(Some(serde_json::json!({ "synced": lines, "plain": plain })));
        }
    }
    Ok(None)
}
