-- PrimerLoop seed: Foundations + LLM App Engineering (wife + friends ready)

insert into subjects (slug, name)
values ('ai-llm-systems', 'AI & LLM Systems')
on conflict (slug) do nothing;

with subject as (
  select id
  from subjects
  where slug = 'ai-llm-systems'
  limit 1
)
insert into concepts (subject_id, slug, title, description, track, difficulty)
select subject.id, items.slug, items.title, items.description, items.track, items.difficulty
from subject
join (
  values
    -------------------------------------------------------------------------
    -- FOUNDATIONS (Ground Zero → RAG)
    -------------------------------------------------------------------------
    ('submit-flow', 'What Happens When You Hit Submit?', 'From your text to tokens to next-token prediction (the big picture).', 'FOUNDATIONS', 'beginner'),
    ('llm-what-is', 'What Is a Large Language Model?', 'What an LLM is (and is not), plus training vs inference at a high level.', 'FOUNDATIONS', 'beginner'),
    ('tokens-basics', 'Tokens', 'Tokens as the unit of cost, context, and prediction. Includes real tokenization intuition.', 'FOUNDATIONS', 'beginner'),
    ('context-windows', 'Context Windows', 'The model’s working memory. Input+output share the same limit. Why chats degrade.', 'FOUNDATIONS', 'beginner'),
    ('why-limits', 'Why Models Have Limits', 'Why bigger context isn’t free: attention scaling, cost, latency, and dilution.', 'FOUNDATIONS', 'beginner'),
    ('sampling-basics', 'Sampling', 'How the model chooses the next token: greedy vs temperature vs top-p. Variability vs truth.', 'FOUNDATIONS', 'beginner'),
    ('embeddings-basics', 'Embeddings', 'Convert text into meaning-vectors for similarity search. Embeddings ≠ generation.', 'FOUNDATIONS', 'beginner'),
    ('vector-db-basics', 'Vector Databases', 'Store and search embeddings efficiently (nearest-neighbor search).', 'FOUNDATIONS', 'beginner'),
    ('rag-basics', 'RAG (Retrieval-Augmented Generation)', 'Retrieve relevant chunks, then generate grounded answers. RAG ≠ fine-tuning.', 'FOUNDATIONS', 'beginner'),

    -------------------------------------------------------------------------
    -- LLM APP ENGINEERING (your original set; now gated behind foundations)
    -------------------------------------------------------------------------
    ('tokens-context', 'Tokens & Context (Applied)', 'Tokenization, context windows, and token budgeting basics (applied).', 'LLM_APP', 'beginner'),
    ('sampling-generation', 'Sampling & Generation Behavior (Applied)', 'How decoding choices affect output consistency and variety (applied).', 'LLM_APP', 'beginner'),
    ('prompting-basics', 'Prompting Basics', 'How to structure prompts for clear task execution.', 'LLM_APP', 'beginner'),
    ('structured-output', 'Structured Output Contracts', 'Schemas and format guarantees for app reliability.', 'LLM_APP', 'beginner'),
    ('context-window-strategies', 'Context Window Strategies', 'Chunking, trimming, and retrieval strategies under token limits.', 'LLM_APP', 'beginner'),
    ('retrieval-augmented-generation', 'Retrieval-Augmented Generation (Applied)', 'Grounding responses with retrieved context (applied patterns).', 'LLM_APP', 'intermediate'),
    ('evaluation-basics', 'Evaluation Basics', 'Measure quality with repeatable checks and scorecards.', 'LLM_APP', 'intermediate'),
    ('caching-latency-cost', 'Caching, Latency, and Cost', 'Reduce latency and spend using cache-aware architecture.', 'LLM_APP', 'intermediate'),
    ('tool-calling-basics', 'Tool Calling Basics', 'Connect the model to deterministic tools and APIs.', 'LLM_APP', 'intermediate'),
    ('agent-loops-safety', 'Agent Loops and Safety', 'Constrain iterative plans with guards and budgets.', 'LLM_APP', 'advanced'),
    ('prompt-injection-defense', 'Prompt Injection Defense', 'Protect system instructions and tool boundaries.', 'LLM_APP', 'advanced'),
    ('production-observability', 'Production Observability', 'Track quality, cost, and reliability signals in production.', 'CORE_TECH', 'advanced')
) as items(slug, title, description, track, difficulty)
  on true
on conflict (slug) do nothing;

-- Prerequisite graph
-- Rule: unlocked if ALL prereqs reach mastery level >= 3

insert into concept_prerequisites (concept_id, prerequisite_concept_id)
select c.id, p.id
from concepts c
join concepts p on p.subject_id = c.subject_id
join (
  values
    -------------------------------------------------------------------------
    -- FOUNDATIONS spine
    -------------------------------------------------------------------------
    ('llm-what-is', 'submit-flow'),
    ('tokens-basics', 'llm-what-is'),
    ('context-windows', 'tokens-basics'),
    ('why-limits', 'context-windows'),
    ('sampling-basics', 'why-limits'),
    ('embeddings-basics', 'sampling-basics'),
    ('vector-db-basics', 'embeddings-basics'),
    ('rag-basics', 'vector-db-basics'),

    -------------------------------------------------------------------------
    -- Gate applied/engineering concepts behind foundations
    -------------------------------------------------------------------------
    -- Applied Tokens & Context should not appear until the fundamentals are done
    ('tokens-context', 'tokens-basics'),
    ('tokens-context', 'context-windows'),
    ('tokens-context', 'why-limits'),

    -- Applied Sampling should not appear until fundamental sampling is done
    ('sampling-generation', 'sampling-basics'),
    ('sampling-generation', 'tokens-context'),

    -- Prompting should come after you understand how inference behaves
    ('prompting-basics', 'sampling-basics'),

    ('structured-output', 'prompting-basics'),

    -- Strategies should come after you understand context + limits
    ('context-window-strategies', 'why-limits'),
    ('context-window-strategies', 'tokens-context'),

    -- Applied RAG should come after RAG basics + structured output (so you can build reliable flows)
    ('retrieval-augmented-generation', 'rag-basics'),
    ('retrieval-augmented-generation', 'structured-output'),

    ('evaluation-basics', 'structured-output'),

    ('caching-latency-cost', 'retrieval-augmented-generation'),

    ('tool-calling-basics', 'structured-output'),

    ('agent-loops-safety', 'tool-calling-basics'),
    ('prompt-injection-defense', 'tool-calling-basics'),

    ('production-observability', 'evaluation-basics'),
    ('production-observability', 'caching-latency-cost')
) as edges(concept_slug, prerequisite_slug)
  on c.slug = edges.concept_slug and p.slug = edges.prerequisite_slug
where c.subject_id = p.subject_id
on conflict (concept_id, prerequisite_concept_id) do nothing;
