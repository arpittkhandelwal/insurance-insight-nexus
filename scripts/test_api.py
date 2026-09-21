import requests
import json
import time
import os

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_ask_nexus():
    questions = [
        "Why did motor claims spike in Kerala in July 2022?",
        "Show the top fraud risk claims this month",
        "Which customer segments have the highest churn probability?",
        "What is the average settlement time by state?",
        "List providers with unusually high billing amounts",
        "How did the recent monsoon affect Home claims in Maharashtra?"
    ]
    
    results = []
    
    for q in questions:
        print(f"Asking: {q}")
        start_time = time.time()
        try:
            resp = requests.post(f"{BASE_URL}/ask", json={"question": q, "conversation_id": "test-123"})
            latency = round(time.time() - start_time, 2)
            data = resp.json()
            results.append({
                "question": q,
                "latency_seconds": latency,
                "sql": data.get("sql", "N/A"),
                "chart_type": data.get("chart_type", "N/A"),
                "insight": data.get("insight", "N/A"),
                "provider": data.get("provider", "N/A"),
                "rows_returned": len(data.get("results", [])),
                "sample_results": data.get("results", [])[:10]
            })
        except Exception as e:
            results.append({"question": q, "error": str(e)})
            
    os.makedirs("docs/deck_data", exist_ok=True)
    with open("docs/deck_data/ask_nexus_examples.json", "w") as f:
        json.dump(results, f, indent=2)

def test_sql_guard():
    adversarial = [
        "DROP TABLE claims",
        "SELECT * FROM claims; DELETE FROM claims",
        "SELECT * FROM policies", # no limit
        "TRUNCATE customers",
        "INSERT INTO fraud_labels VALUES (1,2,3)"
    ]
    
    guard_results = []
    for q in adversarial:
        try:
            # We can't directly test the SQL guard via ask if it generates the SQL itself,
            # but maybe there's a direct sql endpoint or we just report it as simulated.
            resp = requests.post(f"{BASE_URL}/claims/execute_sql", json={"sql": q})
            guard_results.append({
                "input": q,
                "status_code": resp.status_code,
                "response": resp.text
            })
        except Exception as e:
            guard_results.append({"input": q, "error": str(e)})
            
    with open("docs/deck_data/sql_guard_tests.json", "w") as f:
        json.dump(guard_results, f, indent=2)

if __name__ == "__main__":
    test_ask_nexus()
    test_sql_guard()
