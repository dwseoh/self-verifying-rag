# TrustLoop

TrustLoop is a real-time self-verifying enterprise RAG assistant powered by Gemma 4 on Cerebras.

It answers questions from enterprise documents, extracts factual claims, verifies citations with parallel agents, flags unsupported claims, and returns a confidence score with an audit trail.

## Why Cerebras?

TrustLoop runs multiple verifier agents in parallel before showing the answer. This would normally add too much latency, but Cerebras makes the verification loop fast enough to feel instant.