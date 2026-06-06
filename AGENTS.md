# AGENTS.md

## Project Identity

This project is a Vite + React + TypeScript prototype for a general-purpose, Instagram-like local feed.

The first goal is a small local feed experience built from static data and local assets. The codebase should stay general enough that the same feed model can later support an internal company equipment-report feed, but the core product model is not equipment-specific.

## Core Domain

Use these generic concepts for core types, shared components, routes, and data flow:

- Account
- Post
- Feed
- Follow
- Asset
- Metadata

Do not introduce equipment-report-specific terms into core type names or primary component names. Avoid names such as:

- Equipment
- Chamber
- Sensor
- Recipe
- Severity
- Report

When equipment-report-specific information is needed, represent it as `post.metadata` or asset metadata. Keep domain-specific values as data, not as the foundation of the app architecture.

## Current Implementation Scope

This stage is intentionally local and static.

- Use static JSON data.
- Keep static assets under `public/assets`.
- Do not implement a backend, database, authentication, likes, comments, notifications, upload flows, file write logic, deployment, or real-time updates.
- Follow state is expected to move to `localStorage` later, but should remain lightweight and local.

## Development Guidelines

- Keep the TypeScript build passing at all times.
- Prefer small, focused changes.
- Avoid unnecessary large refactors.
- Follow existing project patterns before adding new abstractions.
- Keep components and types reusable for both general personal feeds and future company-internal report feeds.
- Treat equipment-report examples as one possible data scenario, not as the core domain.

## Verification

After code changes, run the project build from the Vite app directory:

```bash
npm run build
```

The build should pass before handing work back.
