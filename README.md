# Tools & Frameworks

# Backend stack: 
Flask + Flask-CORS API (app.py) with SQLAlchemy models (models.py) persisting to  
SQLite/Postgres via DATABASE_URL, seeded from data/advice_docs.json; .env controls  
 OpenAI + DB credentials. 
# Agentic services: 
- openai_summary_service.py powers parent chat + text-to-SQL reasoning over tables  
 (children, task_emotion_logs, child_events, etc.),
- task_template_service.py reforms caregiver guidance into schedules,
- distress_alert_service.py escalates high-stress streaks into ParentAlerts, 
- friend_service.py + tts_service.py transcribe child audio and reply with Buddy Fox voice notes, 
- avatar_service.py renders DALL·E-led emotion boards. 
# RAG workflow: 
ingest.js scrapes locally downloaded PDFs (or web-scraped docs you drop in rag/books/),  
 chunks them, and index.js embeds with text-embedding-3-large into a Chroma collection  
  consumed by rag_service.py for contextual answers and task planning; retrieve.js   
  mirrors that flow for manual testing. Text-to-SQL dataset: openai_summary_service.
# TEXT_TO_SQL_PROMPT 
openai_summary_service.TEXT_TO_SQL_PROMPT converts caregiver questions into safe SELECTs  
 scoped by :child_id, runs them against the relational store, and feeds the rows back into  
  GPT-4o-mini so parents get telemetry-grounded summaries instead of canned Q&A.
# Frontend stack:
Vite + React + TypeScript + Tailwind/shadcn UI (emotion-explorer-kids-8a15e168),   
React Router for dual /parent + /child experiences, TanStack Query for data fetching,  
 and shared toasts/tooltips; 
- ParentHubFrame loads the parent design system
- Child app (Index.tsx) routes to Tasks, Games, Speech Helper, and Virtual Friend.
