import duckdb
import json
import csv
import os
import time

def extract_facts():
    print("Connecting to DuckDB...")
    con = duckdb.connect(database=':memory:')
    
    # Check what tables exist in data/parquet/
    tables = {}
    data_dir = "data/parquet"
    for file in os.listdir(data_dir):
        if file.endswith('.parquet'):
            table_name = file.replace('.parquet', '')
            tables[table_name] = os.path.join(data_dir, file)
            con.execute(f"CREATE VIEW {table_name} AS SELECT * FROM read_parquet('{tables[table_name]}')")
            print(f"Loaded view {table_name}")

    # Create deck_data directory if it doesn't exist
    os.makedirs("docs/deck_data", exist_ok=True)
    
    facts = {}
    
    # 1. Table Stats
    facts['tables'] = {}
    for table_name in tables.keys():
        row_count = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        col_count = len(con.execute(f"DESCRIBE {table_name}").fetchall())
        size_bytes = os.path.getsize(tables[table_name])
        # Try to find a date column
        cols = [c[0] for c in con.execute(f"DESCRIBE {table_name}").fetchall()]
        date_col = next((c for c in cols if 'date' in c.lower() or 'time' in c.lower() or c == 'month'), None)
        date_range = "N/A"
        if date_col:
            try:
                min_date = con.execute(f"SELECT MIN({date_col}) FROM {table_name}").fetchone()[0]
                max_date = con.execute(f"SELECT MAX({date_col}) FROM {table_name}").fetchone()[0]
                date_range = f"{min_date} to {max_date}"
            except Exception:
                pass
        
        facts['tables'][table_name] = {
            'rows': row_count,
            'cols': col_count,
            'size_bytes': size_bytes,
            'date_range': date_range
        }
        
    # Key portfolio numbers
    if 'policies' in tables:
        facts['total_policies'] = con.execute("SELECT COUNT(*) FROM policies").fetchone()[0]
        try:
            facts['total_customers'] = con.execute("SELECT COUNT(DISTINCT customer_id) FROM policies").fetchone()[0]
        except Exception:
            pass
        try:
            facts['gwp'] = con.execute("SELECT SUM(base_premium) FROM policies").fetchone()[0]
        except Exception:
            try:
                facts['gwp'] = con.execute("SELECT SUM(premium) FROM policies").fetchone()[0]
            except Exception:
                pass
        try:
            facts['lapse_rate'] = con.execute("SELECT SUM(CASE WHEN status='Lapsed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) FROM policies").fetchone()[0]
        except Exception:
            facts['lapse_rate'] = "N/A"
            
    if 'claims' in tables:
        facts['total_claims'] = con.execute("SELECT COUNT(*) FROM claims").fetchone()[0]
        try:
            facts['total_claims_paid'] = con.execute("SELECT SUM(amount_approved) FROM claims WHERE status='Closed'").fetchone()[0]
        except Exception:
            facts['total_claims_paid'] = "N/A"
        try:
            facts['avg_settlement_days'] = con.execute("SELECT AVG(date_diff('day', CAST(loss_date AS DATE), CAST(settlement_date AS DATE))) FROM claims WHERE status='Closed'").fetchone()[0]
        except Exception:
            facts['avg_settlement_days'] = "N/A"
            
        try:
            facts['fraud_flagged_count'] = con.execute("SELECT COUNT(*) FROM claims WHERE risk_score > 80 OR is_fraud_ring=true").fetchone()[0]
            facts['fraud_exposure'] = con.execute("SELECT SUM(amount_claimed) FROM claims WHERE risk_score > 80 OR is_fraud_ring=true").fetchone()[0]
        except Exception:
            facts['fraud_flagged_count'] = "N/A"
            facts['fraud_exposure'] = "N/A"
        
    # Write facts to JSON
    with open('docs/deck_data/kpi_values.json', 'w') as f:
        json.dump(facts, f, indent=2, default=str)
        
    # Generate CSVs
    if 'claims' in tables:
        try:
            # Monthly claims paid
            monthly = con.execute("""
                SELECT strftime(CAST(loss_date AS DATE), '%Y-%m') as month, 
                       SUM(amount_claimed) as total_claimed,
                       SUM(amount_approved) as total_paid
                FROM claims 
                GROUP BY 1 ORDER BY 1
            """).fetchdf()
            monthly.to_csv('docs/deck_data/monthly_claims.csv', index=False)
        except Exception as e:
            print("Failed monthly claims CSV:", e)
            
        # Loss ratio by state
        if 'policies' in tables:
            try:
                lr_state = con.execute("""
                    SELECT p.state, 
                           SUM(c.amount_approved) as paid, 
                           SUM(COALESCE(p.base_premium, 0)) as premium,
                           (SUM(c.amount_approved) * 1.0 / NULLIF(SUM(COALESCE(p.base_premium, 0)), 0)) * 100 as loss_ratio
                    FROM claims c JOIN policies p ON c.policy_id = p.policy_id
                    GROUP BY 1 ORDER BY 4 DESC
                """).fetchdf()
                lr_state.to_csv('docs/deck_data/loss_ratio.csv', index=False)
                
                # Heatmap data
                lr_state.to_csv('docs/deck_data/heatmap.csv', index=False)
            except Exception as e:
                print("Failed loss ratio CSV:", e)
            
        try:
            # Top fraud entities
            fraud = con.execute("""
                SELECT claim_id, policy_id, amount_claimed, cause_of_loss, risk_score
                FROM claims
                WHERE risk_score > 80
                ORDER BY risk_score DESC
                LIMIT 50
            """).fetchdf()
            fraud.to_csv('docs/deck_data/top_entities.csv', index=False)
        except Exception as e:
            print("Failed top fraud entities CSV:", e)
        
        try:
            # Fraud distribution
            con.execute("""
                SELECT floor(risk_score / 10) * 10 as score_bucket, count(*) as count
                FROM claims
                GROUP BY 1 ORDER BY 1
            """).fetchdf().to_csv('docs/deck_data/fraud_score.csv', index=False)
        except Exception as e:
            print("Failed fraud distribution CSV:", e)
        
    print("Done extracting facts.")
    
if __name__ == "__main__":
    extract_facts()
