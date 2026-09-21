# Insurance Insight Nexus - Winning Hackathon Video Script

**Presenter**: Arpit Khandelwal
**Team**: BR Vertos
**Target Length**: 3-4 minutes
**Goal**: Impress the judges by showcasing the agentic AI capabilities, the speed of DuckDB, the compliance architecture, and a complete tour of the platform.

---

## How to Record the Video
1. **Tooling**: Use OBS Studio, Loom, or macOS QuickTime.
2. **Audio**: Speak clearly with enthusiasm. You are pitching an enterprise-grade AI solution.
3. **Pacing**: Move through the pages swiftly. Do not linger too long on any single chart.

---

## The Script

### [0:00 - 0:30] Introduction & The Problem
**Visual**: Start with your title slide, then cut directly to the **Command Center** dashboard.
**Audio (Arpit)**: 
> "Hello everyone, my name is Arpit Khandelwal representing Team BR Vertos. Insurance companies sit on terabytes of claims data, but extracting actionable insights takes days. Meanwhile, fraud rings bleed millions from the portfolio. We built **Insurance Insight Nexus**—the world's first AI-powered conversational analytics platform built on an ultra-fast DuckDB data layer to solve this."

### [0:30 - 0:50] Command Center (Dashboard)
**Visual**: Scroll through the KPI cards and the live charts on the **Command Center** page.
**Audio (Arpit)**:
> "We start at the Command Center. This provides executives with an instant, real-time pulse on the entire portfolio—total policies, claims processed, and our current fraud exposure, all loading in milliseconds thanks to our serverless AWS architecture."

### [0:50 - 1:30] The "Wow" Moment: Ask Nexus
**Visual**: Navigate to the **Ask Nexus** page. Type: *"Why did motor claims spike in Kerala in July 2022?"* Hit enter. Show the agent generating SQL.
**Audio (Arpit)**:
> "But dashboards only answer questions we already know to ask. Watch what happens when we use **Ask Nexus**. By typing a natural language question, our agentic AI workflow—powered by Amazon Bedrock—dynamically writes and executes DuckDB SQL safely. In seconds, we see that monsoon events drove a 300 percent spike in motor claims."

### [1:30 - 1:50] Claims Analytics
**Visual**: Navigate to the **Claims Analytics** page.
**Audio (Arpit)**:
> "For our data analysts, the Claims Analytics page provides deep time-series forecasting. We can track settlement times, loss ratios across states, and detect statistical anomalies before they impact the bottom line."

### [1:50 - 2:20] Fraud Risk Center & Fraud Graph
**Visual**: Navigate to the **Fraud Risk Center**. Then show the **Fraud Graph** page and hover over the connected nodes.
**Audio (Arpit)**:
> "Insight is great, but action is better. In the Fraud Risk Center, our ML pipeline constantly scores live claims. And using the Fraud Graph, investigators do not just see isolated claims—they visualize the entire network of coordinated fraud rings, stopping organized leakage dead in its tracks."

### [2:20 - 2:50] Human-in-the-Loop: Case Management & Audit Log
**Visual**: Go to **Case Management**. Click "Reject" on a claim. Then navigate to the **Audit Log** page to show the DynamoDB entry. Highlight the yellow "Insight" banner at the top of the app.
**Audio (Arpit)**:
> "In fintech, AI cannot make final decisions alone. Compliance is everything. That is why we enforce a strict **Human-in-the-Loop** workflow. AI flags anomalies, but humans approve or reject them in the Case Management queue. Every decision is immutably recorded in our DynamoDB Audit Log."

### [2:50 - 3:10] Model Monitoring
**Visual**: Click on the **Model Monitoring** page to show the ROC and F1 score charts.
**Audio (Arpit)**:
> "Finally, our Data Science teams have full transparency into the AI's performance through the Model Monitoring page, ensuring our fraud models remain accurate and unbiased over time without drift."

### [3:10 - 3:30] Outro
**Visual**: Show your AWS Architecture slide (ECS Fargate, ALB, CloudFront) or remain on the Command Center.
**Audio (Arpit)**:
> "Insurance Insight Nexus secures the portfolio, empowers investigators, and brings agentic AI to the enterprise safely and compliantly. We are Team BR Vertos. Thank you."
