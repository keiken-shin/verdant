use scraper::{Html, Selector};
use serde_json::{json, Value};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};

pub fn web_search(query: &str) -> Result<Value, String> {
    let url = format!("https://html.duckduckgo.com/html/?q={}", urlencoding::encode(query));
    
    let mut headers = HeaderMap::new();
    // Use a standard browser user agent to prevent simple blocking
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"),
    );

    let client = reqwest::blocking::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let res = client.get(&url).send().map_err(|e| format!("HTTP request failed: {}", e))?;
    
    if !res.status().is_success() {
        return Err(format!("Search engine returned error: {}", res.status()));
    }

    let body = res.text().map_err(|e| format!("Failed to read response body: {}", e))?;
    
    let document = Html::parse_document(&body);
    
    // DuckDuckGo HTML structure (varies, but usually .result__title and .result__snippet)
    let result_selector = Selector::parse(".result").unwrap();
    let title_selector = Selector::parse(".result__title a").unwrap();
    let snippet_selector = Selector::parse(".result__snippet").unwrap();
    let url_selector = Selector::parse(".result__url").unwrap();

    let mut results = Vec::new();
    let mut count = 0;

    for element in document.select(&result_selector) {
        if count >= 5 { break; } // Limit to top 5 results

        let title = element.select(&title_selector).next()
            .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string());
        
        let snippet = element.select(&snippet_selector).next()
            .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string());
            
        let link = element.select(&url_selector).next()
            .map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string());

        if let (Some(t), Some(s), Some(l)) = (title, snippet, link) {
            results.push(json!({
                "title": t,
                "snippet": s,
                "url": format!("https://{}", l.trim_start_matches("https://").trim_start_matches("http://").trim())
            }));
            count += 1;
        }
    }

    if results.is_empty() {
        return Ok(json!({
            "status": "No results found or search blocked",
            "query": query
        }));
    }

    Ok(json!({
        "query": query,
        "results": results
    }))
}
