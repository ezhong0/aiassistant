# Complete Job Search Guide - Edward Zhong

**Last Updated:** January 2025
**Goal:** Land first full-time engineering role at a startup within 1-3 months
**Target Level:** Entry to Mid-Level Engineer (NOT senior)

---

## Table of Contents

1. [Your Current Position - The Honest Assessment](#your-current-position)
2. [Your Story - How to Talk About Yourself](#your-story)
3. [Resume Strategy](#resume-strategy)
4. [GitHub & Portfolio](#github-portfolio)
5. [Networking Strategy (Your Biggest Advantage)](#networking-strategy)
6. [Application Strategy](#application-strategy)
7. [Interview Preparation](#interview-preparation)
8. [Week-by-Week Action Plan](#action-plan)
9. [Message Templates](#message-templates)
10. [Reality Check & Expectations](#reality-check)

---

<a name="your-current-position"></a>
## 1. Your Current Position - The Honest Assessment

### What You Have Going For You

**Technical Skills:**
- Built production-grade system with 29K+ lines of TypeScript
- Novel 3-layer architecture (genuinely impressive)
- Senior-level code quality (DI, testing, security, documentation)
- Full-stack capability (backend expert, frontend competent)
- Shipped in 1 month what takes most teams 3-4 months

**Recent Network Building:**
- Meeting people at hackathons ✓
- Leaving good impressions ✓
- Building relationships in the community ✓

**Education & Background:**
- CS degree from UCSB (2023)
- Internships at Bill.com (2019) and Stanford (2018)
- Overcame executive function challenges (shows resilience)

### What's Working Against You

**Experience Gap:**
- No full-time professional experience
- 2-year gap since graduation (just tutoring)
- Zero team collaboration experience
- No production systems at scale

**Job Market Reality:**
- Tough market right now (2024-2025)
- Competing with people who have 2-5 YOE
- Many companies have hiring freezes
- New grad programs mostly closed

**Social Presence:**
- No meaningful X/LinkedIn following
- AI-generated posts won't help
- Need to leverage real relationships instead

### The Bottom Line

**You are NOT a senior engineer.** You are a talented junior/mid-level engineer with impressive technical depth but zero professional team experience. That's okay - work with reality, not aspiration.

**Your path to a job:** Leverage the hackathon connections you're building + showcase the impressive codebase + apply strategically to startups that value builders.

---

<a name="your-story"></a>
## 2. Your Story - How to Talk About Yourself

### The Narrative (Memorize This)

**Short version (networking/casual):**
> "I graduated from UCSB in 2023 with a CS degree. I spent some time tutoring while working through some personal challenges, but stayed sharp by building projects. Recently built a production-grade AI assistant that handles complex email queries. Now I'm looking for my first full-time role where I can work on a team and ship real products."

**Long version (interviews):**
> "After graduating from UCSB in 2023, I took some time to deal with personal challenges while tutoring on the side. During that period, I kept coding and learning. Recently, I built an AI assistant platform with a novel 3-layer architecture that decomposes natural language queries into execution graphs, runs operations in parallel, and synthesizes results. It's about 30K lines of production-grade TypeScript with OAuth 2.0, comprehensive testing, and full documentation.
>
> Building that solo taught me a lot about system design and writing quality code, but I'm eager to join a team where I can learn from experienced engineers, ship products that real users depend on, and contribute to something bigger than myself. I think the work you're doing at [Company] is really interesting because [specific reason]."

### What NOT to Say

**Don't:**
- ❌ "I'm a senior engineer"
- ❌ "I have 2+ years of experience" (tutoring doesn't count)
- ❌ Apologize excessively for the gap
- ❌ Get defensive about executive function issues
- ❌ Oversell or exaggerate
- ❌ Talk about how every line was "AI-generated"
- ❌ Say you're "just looking for anything"

**Do:**
- ✅ Own the gap briefly and move forward
- ✅ Focus on what you've built and what you can do
- ✅ Show genuine interest in the specific company
- ✅ Ask thoughtful questions about their tech/team
- ✅ Demonstrate eagerness to learn
- ✅ Be honest about limited team experience

### Handling the Gap Question

**Interviewer:** "I see you graduated in 2023. What have you been doing since then?"

**Your answer:**
> "I spent time tutoring while dealing with some personal challenges. During that time, I stayed technically sharp by building projects. Most recently, I built [assistantapp project]. I'm past those challenges now and excited to join a team full-time."

Then **immediately pivot** to talking about what you learned from the project or asking about their company.

**Do NOT:**
- Dwell on the challenges
- Go into detail about executive function issues
- Make excuses
- Act like it's a big deal

Acknowledge it in 2 sentences, then move on. Confidence is key.

---

<a name="resume-strategy"></a>
## 3. Resume Strategy

### Current Resume Issues to Fix

1. **Integuru (2024-Present)** - Is this real? If not, DELETE IT. If it is real but embellished, tone it down to match reality.
2. **Project description is wrong** - Says "Slack AI assistant" but your code is email/calendar assistant
3. **Claims "2+ years experience"** - Misleading, you have internships from 2018-2019
4. **Too much AI-generated fluff** - Reads generic, not authentic

### New Resume Structure

**Order of sections (importance):**
1. Header (name, contact, GitHub, LinkedIn)
2. **Projects** ← Your strongest asset, put this FIRST
3. Skills
4. Work Experience (internships)
5. Education

### Projects Section - Rewrite This

**Current:** Completely wrong description (Slack vs Email)

**New version:**

```latex
\cvprojectinline
    {\href{https://github.com/ezhong0/assistantapp}{github.com/ezhong0/assistantapp}} % Link
    {AI-Powered Email \& Calendar Assistant} % Project
    {Node.js, TypeScript, PostgreSQL, OpenAI, React Native} % Technology
    {2024 - 2025} % Date(s)
    {
      \begin{cvitems}
        \item {Architected production-grade AI assistant with novel 3-layer architecture: query decomposition → parallel execution → natural language synthesis}
        \item {Implemented DAG-based execution engine with dependency resolution, processing complex queries like "Show me urgent emails I haven't responded to"}
        \item {Built comprehensive backend with OAuth 2.0, encrypted token storage, rate limiting, circuit breakers, and comprehensive error handling}
        \item {Developed custom E2E testing framework with AI-powered validation, achieving 80\%+ test coverage across 127 TypeScript source files}
        \item {Integrated Google Workspace APIs (Gmail, Calendar, Contacts) with intelligent batching via DataLoader pattern for 10x performance improvement}
        \item {Documented 700+ use cases covering inbox triage, commitment tracking, and context recovery across multiple communication channels}
      \end{cvitems}
    }
```

**Why this works:**
- Accurate to what you actually built
- Highlights novel architecture (3-layer DAG system)
- Shows production-grade thinking (OAuth, testing, performance)
- Quantifies impact (80% coverage, 127 files, 700+ use cases, 10x performance)
- Uses active verbs (Architected, Implemented, Built, Developed)

### Summary Section - Rewrite This

**Current:** "Full-stack Software Engineer with 2+ years experience" ← This is misleading

**New version:**

```latex
\begin{cvsummary}
Recent UCSB CS graduate with strong foundation in full-stack development, system architecture, and AI integration. Built production-grade applications demonstrating expertise in TypeScript, Node.js, and React. Proven ability to architect complex systems, write clean maintainable code, and ship quality software. Seeking first full-time role to contribute to a fast-moving team and grow as an engineer.
\end{cvsummary}
```

**Why this works:**
- Honest about being recent grad
- Emphasizes strengths (architecture, code quality, shipping)
- Shows what you bring (technical skills)
- States what you want (first full-time role, growth)

### Work Experience Section

**Keep:**
- Bill.com (2019) - real, impressive
- Stanford (2018) - real, fine to include

**Question mark:**
- Integuru - If this is real, keep it. If it's embellished or fake, DELETE IT.

**Missing:**
- Tutoring work - If Integuru isn't real, add a simple tutoring entry:

```latex
\cventry
  {Math \& Computer Science Tutor} % Job title
  {Self-Employed} % Organisation
  {Los Altos, CA} % Location
  {2023 -- 2024} % Date(s)
  {
    \begin{cvitems}
      \item {Tutored high school and college students in mathematics, algorithms, and programming fundamentals}
      \item {Developed custom lesson plans and coding exercises tailored to individual learning styles}
    \end{cvitems}
  }
```

### Skills Section - This is Fine

Your skills section is actually good. Keep it as-is.

### Header - Add This

Make sure your GitHub link is PROMINENT:

```latex
\github{github.com/ezhong0}  % Make sure this links to your actual profile
```

And consider adding:

```latex
\homepage{edwardzhong.dev}  % If you make a simple portfolio site
```

---

<a name="github-portfolio"></a>
## 4. GitHub & Portfolio

### Critical: Make Your Repo Public

**Current state:** assistantapp is private, nobody can see it
**Action:** Make it public (after removing any API keys/secrets)

### Write a Killer README.md

Your README should tell a story in 30 seconds. Here's the template:

```markdown
# AI Assistant for Email & Calendar Management

> A production-grade AI assistant that understands complex natural language queries and orchestrates multi-step operations across Google Workspace APIs.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## Demo

[📹 Watch 2-minute demo video](https://youtube.com/your-demo-link)

## What It Does

Instead of searching through hundreds of emails manually, ask questions in natural language:

- "Show me urgent emails I haven't responded to"
- "What meetings do I have this week?"
- "Find all emails where I promised to follow up"
- "Catch me up on the Smith project"

The assistant decomposes your query into an execution graph, runs operations in parallel, and synthesizes a natural language response.

## Architecture Highlights

**3-Layer Processing System:**

```
┌─────────────────────────────────────────────┐
│ Layer 1: Query Decomposition               │
│ Natural language → Structured execution DAG │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Layer 2: Parallel Execution                │
│ Runs operations with dependency resolution  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Layer 3: Response Synthesis                │
│ Structured results → Natural language       │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Novel DAG-based execution** with automatic dependency resolution
- **Production security**: OAuth 2.0, encrypted tokens, rate limiting
- **Performance optimization**: DataLoader pattern, intelligent batching
- **Comprehensive testing**: Custom E2E framework with AI validation
- **Enterprise patterns**: DI, circuit breakers, structured logging

## Tech Stack

**Backend:**
- Node.js 20+ with TypeScript (strict mode)
- Express.js with comprehensive middleware
- PostgreSQL via Supabase
- Redis caching (optional)

**AI Integration:**
- OpenAI GPT-4 for query decomposition
- Anthropic Claude for response synthesis
- Structured output validation

**Infrastructure:**
- Docker containerization
- Railway deployment
- Sentry error tracking
- Winston structured logging

## Project Stats

- 29,744 lines of TypeScript
- 127 source files, 36 test files
- 80%+ test coverage
- 700+ documented use cases
- Zero TypeScript errors (strict mode)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ezhong0/assistantapp
cd assistantapp/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## Documentation

- [Architecture Overview](docs/architecture/architecture.md)
- [API Reference](docs/api/api.md)
- [Testing Guide](docs/testing/testing.md)
- [Command Library](docs/api/commands.md) - 700+ example queries

## Development Timeline

Built over 4 weeks (322 commits) as a demonstration of:
- System architecture and design
- Production-grade code quality
- Full-stack development
- AI/LLM integration

## Current Status

MVP in active development. 2-3 weeks from first production deployment.

## Contact

Built by Edward Zhong | [GitHub](https://github.com/ezhong0) | [LinkedIn](https://linkedin.com/in/edwardzhong0) | edwardrzhong@gmail.com

---

⭐ If you find this interesting, please star the repo!
```

### Create a Demo Video (Critical!)

**Platform:** Loom (free) or YouTube

**Length:** 2 minutes max

**Script:**
1. (0:00-0:20) "Hi, I'm Edward. I built an AI assistant that helps you manage email and calendar through natural language queries. Let me show you how it works."
2. (0:20-0:40) Show the problem: "Here's my inbox with 200 emails. Finding what's urgent is painful."
3. (0:40-1:20) Show the solution: "I can ask: 'Show me urgent emails I haven't responded to' and watch it work." Demo the query, show the execution graph, show the response.
4. (1:20-1:45) Quick architecture overview: "Under the hood, it uses a 3-layer system. Layer 1 decomposes the query, Layer 2 executes in parallel, Layer 3 synthesizes the response."
5. (1:45-2:00) "The whole backend is production-grade TypeScript with OAuth, testing, and comprehensive docs. Check out the repo for more details. Thanks!"

**Tips:**
- Script it, rehearse it, make it tight
- Show your face (builds trust)
- Use screen recording for the demo portion
- Don't apologize or say "this isn't perfect"
- Sound enthusiastic but not over-the-top

### Pin the Repo on Your GitHub Profile

Make it the first thing people see when they visit github.com/ezhong0

---

<a name="networking-strategy"></a>
## 5. Networking Strategy (Your Biggest Advantage)

This is where you have a HUGE opportunity. You're already meeting people at hackathons and leaving good impressions. Now you need to follow up effectively.

### The Awkwardness is Normal

**Everyone feels awkward reaching out.** Here's the truth:
- People WANT to help if they like you
- They expect you to follow up
- NOT following up is weirder than following up
- The worst they can say is no or ghost you

### The Follow-Up Timeline

**At the hackathon (same day):**
1. Have good conversations (you're already doing this ✓)
2. Ask what they're working on, show genuine interest
3. Share what you're building (the AI assistant)
4. **Before you part:** "Hey, I'd love to stay in touch. Are you on LinkedIn?"
5. Connect on LinkedIn RIGHT THERE (pull out your phone, do it together)

**That night or next day:**
Send a short message on LinkedIn:

```
Hey [Name], great meeting you at [Hackathon]! Really enjoyed hearing about [specific thing they mentioned].

I'm working on [brief description of your project] - would love to share more if you're interested. Also happy to chat about [topic you discussed] anytime.

Hope to see you at the next one!
```

**1-2 weeks later (if appropriate):**
Follow up with something specific:

```
Hey [Name], hope you're doing well! I finished up that [feature/project]
we talked about at [Hackathon]. Thought you might find it interesting: [link]

Also, I saw [Company] is hiring for [role]. Any chance you'd be open to chatting
about what it's like to work there? I'd love to learn more about the team.
```

### Types of Connections & How to Leverage

**Type 1: Engineers at Startups (Highest Value)**

These people can refer you directly.

**Initial approach:**
- Build relationship first (2-3 interactions)
- Show interest in their work
- Share your project, get their feedback

**The ask (after rapport is built):**
```
Hey [Name], I'm starting my job search and [Company] is high on my list.
I know you're on the engineering team there. Any chance you'd be willing to
refer me or introduce me to the hiring manager?

Happy to send you my resume and GitHub. I think the [AI assistant] project
demonstrates I can ship quality code, even though I'm early in my career.
```

**Type 2: Other Job Seekers / Recent Grads**

These people are in the same boat. They're valuable for:
- Mutual accountability
- Sharing job leads
- Practice interviews together
- Emotional support

**How to leverage:**
```
Hey [Name], I remember you were also looking for roles. Want to set up
a weekly call to share job leads and practice technical interviews together?
```

**Type 3: Founders / Senior Engineers**

These people might not hire you directly but can:
- Give advice
- Introduce you to others
- Review your resume/project

**How to leverage:**
```
Hey [Name], I really valued your perspective on [topic] at [Hackathon].
As I'm starting my job search, would you be open to a quick 15-minute call
to get your advice on positioning myself as a junior engineer with a strong
technical project?
```

### The "Warm Intro" Strategy

This is the GOLD standard. Success rate is 10-20x higher than cold applications.

**How it works:**
1. You meet Person A at hackathon (engineer at Company X)
2. You build rapport with Person A
3. Person A introduces you to Person B (hiring manager at Company X)
4. Person B reviews your resume because Person A vouched for you
5. You get an interview

**The message to Person A:**
```
Hey [Person A], I'm really interested in the work Company X is doing with
[specific thing]. I know you mentioned [hiring manager] leads the eng team.
Any chance you'd be comfortable introducing us?

I think my [AI assistant project] would be relevant to what you're building,
and I'd love to learn more about the role.
```

### Action Items for Your Network

**This Week:**
1. Make a spreadsheet of everyone you've met at hackathons
2. Columns: Name, Company, Role, How You Met, Follow-Up Status, Notes
3. For each person, determine their "type" (engineer, job seeker, founder)
4. Send follow-up messages to anyone you haven't contacted in >2 weeks

**Example Spreadsheet:**

| Name | Company | Role | Met At | Last Contact | Type | Next Action | Notes |
|------|---------|------|---------|--------------|------|-------------|-------|
| Sarah Chen | Vercel | Frontend Eng | SF Hackathon Dec 2024 | 12/15/24 | Engineer | Ask about roles | Liked my project, said to stay in touch |
| Mike Patel | Stealth Startup | Founder | SJ Hackathon Jan 2025 | 1/10/25 | Founder | Ask for advice | Building in AI space |
| Jessica Wu | Stripe | New Grad | SF Hackathon Dec 2024 | Never | Job Seeker | Send follow-up | Also looking for jobs |

**This Month:**
1. Go to 2 more hackathons/meetups
2. Meet 5 new people at each
3. Follow up with everyone within 48 hours
4. Move 3-5 relationships to "warm intro" stage

### Hackathons to Attend (Bay Area)

- SF Hacks (monthly)
- Y Combinator events (if you can access)
- React meetups
- AI/ML meetups
- Startup events at Stanford/Berkeley
- Tech talks at companies (many allow non-employees)

Check:
- Meetup.com
- Eventbrite
- Luma
- Hacker News events section
- LinkedIn events

---

<a name="application-strategy"></a>
## 6. Application Strategy

### The Numbers Game

**Reality:**
- Cold applications: 1-2% response rate
- With referrals: 10-20% response rate
- You need to apply to 50-100 companies
- Expect 5-10 phone screens
- Expect 2-3 onsites
- Expect 1 offer (if you execute well)

### Where to Apply

**✅ Apply Here:**

**Y Combinator Companies**
- Site: hiring.ycombinator.com
- Filter: Engineering, Early Stage (Seed to Series A)
- Why: Fast-moving, value builders, less bureaucratic
- Apply to: 20-30 companies

**Wellfound (AngelList)**
- Site: wellfound.com
- Filter: 10-50 employees, SF Bay Area, Remote OK
- Why: Startups hiring generalists
- Apply to: 20-30 companies

**Hacker News "Who's Hiring"**
- Posted first of every month
- Filter: YC companies, early stage, your stack
- Apply to: 10-20 companies

**LinkedIn**
- Search: "startup engineer" + "San Francisco" + "entry level OR mid level"
- Filter: Posted in last week, 10-100 employees
- Apply to: 10-20 companies

**Direct Applications**
- Make a list of 20 specific companies you admire
- Find engineers on LinkedIn who work there
- Message them asking about the role
- Apply through their site

**✅ Companies by Stage:**
- Seed stage (10-25 people): High risk, high learning, equity might be worth something
- Series A (25-50 people): Sweet spot - growing but not bureaucratic
- Series B (50-200 people): More structured, still fast-moving

**❌ Don't Apply Here:**
- FAANG (they want 5+ YOE or new grad program only)
- Big tech (MSFT, Oracle, Salesforce - too bureaucratic)
- Companies requiring "3+ years experience"
- Companies with 1000+ employees (unless you have a referral)

### Company Research Checklist

Before applying, spend 5-10 minutes on:

1. **What do they build?** (Read their homepage)
2. **What's their tech stack?** (Check job description)
3. **How big are they?** (LinkedIn company page)
4. **Recent news?** (Google "[Company] news" or check TechCrunch)
5. **Do I know anyone there?** (LinkedIn connections)

If you can't answer these in 5 minutes, skip the company.

### Application Quality vs Quantity

**The Balance:**
- Don't spend 2 hours on each application (won't hit your numbers)
- Don't spam identical applications (0% success rate)
- Sweet spot: 15-20 minutes per application

**15-Minute Application Process:**
1. (5 min) Research company, read job description
2. (5 min) Customize project bullet point for their domain
3. (5 min) Write custom cover letter intro paragraph
4. (0 min) Submit with standard resume + GitHub link

### Cover Letter Template

Keep it SHORT (3 paragraphs max). Here's the template:

```
Hi [Hiring Manager or "Team"],

I'm reaching out about the [Job Title] position at [Company]. I recently built
a production-grade AI assistant ([GitHub link]) that demonstrates my ability
to architect complex systems and ship quality code.

I'm particularly excited about [Company] because [SPECIFIC REASON - mention
their product, tech stack, or mission. Make this genuine and researched. This
is the only part that changes for each application].

While I'm early in my career (recent UCSB CS grad), the assistantapp project
shows I can design novel architectures (3-layer DAG execution), write
production-grade code (strict TypeScript, OAuth 2.0, comprehensive testing),
and work across the stack. I'd love to contribute to [specific thing they do]
and learn from your engineering team.

Happy to chat this week if you're interested. I've also attached a 2-minute
demo video: [link]

Best,
Edward Zhong
edwardrzhong@gmail.com
github.com/ezhong0
```

**Why this works:**
- Leads with the project (your strength)
- Shows you researched them (specific reason)
- Honest about experience level
- Demonstrates concrete skills
- Provides easy next step (demo video)
- Short (hiring managers get hundreds of these)

### Tracking Your Applications

Use a spreadsheet. Here's the template:

| Company | Role | Date Applied | Source | Status | Contact | Next Step | Notes |
|---------|------|--------------|---------|---------|---------|-----------|-------|
| Vercel | Frontend Eng | 1/15/25 | YC Jobs | Applied | - | Wait 1 week | Using Next.js |
| Retool | Full-Stack | 1/15/25 | Referral (Sarah) | Phone Screen 1/22 | recruiter@retool.com | Prep interview | Sarah vouched |
| Notion | Backend Eng | 1/16/25 | LinkedIn | Rejected | - | - | Required 3+ YOE |

**Why this matters:**
- Prevents duplicate applications
- Tracks follow-ups
- Shows patterns (which sources work)
- Motivates you (see progress)

### Follow-Up Strategy

**Timeline:**
- 1 week after applying: Send follow-up email if no response
- 2 weeks after applying: Move on, assume rejection

**Follow-up email template:**
```
Subject: Following up - [Your Name] - [Job Title]

Hi [Hiring Manager],

I applied for the [Job Title] position last week and wanted to follow up.
I'm genuinely excited about the work [Company] is doing with [specific thing].

I recently built an AI assistant ([GitHub link] + [demo video]) that I think
demonstrates relevant skills for this role. Would love to chat if you're
still considering candidates.

Best,
Edward
```

---

<a name="interview-preparation"></a>
## 7. Interview Preparation

You'll face 4 types of interviews. Prepare for each.

### Type 1: Recruiter Screen (15-30 min)

**Goal:** They're checking if you're worth the eng team's time.

**What they ask:**
- Tell me about yourself
- Walk me through your resume
- Why this company?
- What are you looking for?
- Salary expectations?

**How to prepare:**

**"Tell me about yourself" - Memorize this:**
> "I graduated from UCSB in 2023 with a CS degree. After graduation, I spent time tutoring while dealing with some personal challenges, but I kept coding and building projects. Most recently, I built a production-grade AI assistant with a 3-layer architecture that processes complex email queries. It's about 30K lines of TypeScript with OAuth, comprehensive testing, and full documentation. Now I'm looking for my first full-time role where I can work on a team, ship real products, and continue growing as an engineer."

**"Why this company?" - Research beforehand:**
Have a genuine, specific reason for each company. Examples:
- "I use [Product] regularly and admire the UX"
- "Your tech stack (Node/TypeScript/PostgreSQL) aligns with my experience"
- "I follow [Founder] on Twitter and resonate with their vision for [X]"
- "The problem you're solving ([specific problem]) is one I've experienced"

**"Salary expectations?" - Be prepared:**
- Research: Levels.fyi, Glassdoor (search "junior engineer San Francisco")
- Reasonable range for you: $80K-120K depending on company stage
- Answer: "I'm flexible and more focused on learning and growth than maximizing salary. I've seen ranges of $80-120K for early-career engineers in the Bay Area. Does that align with what you have budgeted?"

**Questions to ask them:**
- "What does a typical day look like for this role?"
- "What are you looking for in the ideal candidate?"
- "What's the team structure?"
- "What's the timeline for this hiring process?"

### Type 2: Technical Phone Screen (45-60 min)

**Goal:** Can you code under pressure?

**Format:**
- 5 min intro
- 35-40 min coding problem (LeetCode medium usually)
- 10 min your questions

**What they evaluate:**
- Can you write working code?
- Do you communicate your thinking?
- How do you handle being stuck?
- Do you test your code?
- Do you consider edge cases?

**How to prepare:**

**LeetCode Study Plan (4-6 weeks):**

**Week 1-2: Fundamentals (Easy problems)**
- Arrays: Two Sum, Best Time to Buy/Sell Stock
- Strings: Valid Anagram, Longest Substring Without Repeating Characters
- Hash Maps: Two Sum, Group Anagrams
- Two Pointers: Container With Most Water, 3Sum

**Week 3-4: Core Patterns (Mediums)**
- Binary Search: Search in Rotated Sorted Array
- Sliding Window: Longest Substring, Max Sliding Window
- Trees: Level Order Traversal, Validate BST
- Graphs: Number of Islands, Course Schedule
- Dynamic Programming: Coin Change, Longest Increasing Subsequence

**Week 5-6: Mock Interviews**
- Do 3-4 full mock interviews (use Pramp or grab a friend)
- Practice talking through your thought process
- Get comfortable being stuck and working through it

**Target:** 50-75 mediums total (2-3 per day)

**Interview Strategy:**

1. **Clarify the problem (2-3 min)**
   - Restate it in your own words
   - Ask about edge cases
   - Confirm input/output format
   - Get example inputs

2. **Discuss approach BEFORE coding (5 min)**
   - "I'm thinking of using [data structure/algorithm]"
   - "The time complexity would be O(n)..."
   - "Does that sound reasonable?"
   - Wait for them to agree before coding

3. **Code while narrating (25 min)**
   - Talk through what you're doing
   - "Now I'm iterating through the array..."
   - "I'm using a hash map here to track..."
   - Don't go silent for >1 minute

4. **Test your code (5 min)**
   - Walk through with the example input
   - Check edge cases (empty input, single element, etc.)
   - Fix bugs if you find them

5. **Analyze complexity (2 min)**
   - "Time complexity is O(n) because..."
   - "Space complexity is O(n) for the hash map..."

**If you get stuck:**
- Say "I'm thinking through [X approach], but I'm not sure about [Y]"
- Ask for a hint: "Would [approach] work here?"
- Don't panic silently - they want to see how you problem-solve

### Type 3: System Design (60-90 min)

**Goal:** Can you architect systems?

**Common for:** Mid-level+ roles (you might not get this, but be prepared)

**Example questions:**
- Design a URL shortener
- Design a rate limiter
- Design a chat application
- Design a notification system

**How to approach:**

1. **Clarify requirements (10 min)**
   - Functional: What features exactly?
   - Non-functional: Scale? Latency? Consistency?
   - "Are we designing for 100 users or 100 million?"

2. **High-level design (15 min)**
   - Draw boxes: Client → API → Database
   - Identify main components
   - Explain data flow

3. **Deep dive (30 min)**
   - Pick 2-3 components to detail
   - Discuss database schema
   - Discuss API endpoints
   - Discuss trade-offs

4. **Scale & optimize (15 min)**
   - "If we had 1M users, we'd need..."
   - Caching, load balancing, CDNs
   - Database sharding, replication

**How to prepare:**
- Read: "Designing Data-Intensive Applications" by Martin Kleppmann
- Watch: YouTube "System Design Interview" videos
- Practice: Explain your assistantapp architecture to someone

**Leverage your project:**
When they ask system design questions, relate it to your project:
- "In my AI assistant, I used [pattern] to solve [similar problem]"
- "I considered [approach A] vs [approach B] and chose A because..."

### Type 4: Behavioral (30-45 min)

**Goal:** Will you fit with the team? How do you handle challenges?

**Common questions:**
- Tell me about a time you faced a difficult bug
- Tell me about a time you disagreed with someone
- Tell me about a time you failed
- How do you handle ambiguity?
- How do you prioritize tasks?
- Why do you want to work here?

**How to answer: STAR Method**

**S**ituation: Set the context
**T**ask: What needed to be done?
**A**ction: What did YOU do?
**R**esult: What was the outcome?

**Example:**

**Question:** "Tell me about a time you faced a difficult bug."

**Bad answer:**
> "Um, I had a bug once where the tests were failing. It was hard. I eventually fixed it by debugging."

**Good answer:**
> **Situation:** "While building my AI assistant, our E2E tests started failing with 'promptBuilder.execute is undefined'. It was blocking our entire test suite.
>
> **Task:** I needed to figure out why the mock setup was broken and fix it without breaking other tests.
>
> **Action:** I first isolated the problem by running individual tests. I discovered our mock factory wasn't properly initializing the dependency injection container. I refactored the mock setup to use a test-specific DI configuration and added validation to catch this type of issue earlier.
>
> **Result:** Fixed the tests within 2 days, and the refactor actually improved our test architecture. We haven't had similar issues since, and now the test setup is more maintainable."

**Prepare 5-7 stories using STAR:**

1. **Difficult bug** (the E2E test issue above)
2. **Technical decision** (choosing the 3-layer architecture)
3. **Overcoming a challenge** (dealing with executive function issues while building)
4. **Learning something new** (learning Supabase, OAuth 2.0, etc.)
5. **Failure / Mistake** (be honest but show what you learned)
6. **Dealing with ambiguity** (deciding what features to build first)
7. **Project you're proud of** (the AI assistant)

**Questions to ask THEM (always have 3-4 ready):**

**About the role:**
- "What does success look like in this role after 6 months?"
- "What's the biggest challenge the team is facing right now?"
- "How much autonomy do junior engineers have?"

**About the team:**
- "What's the code review process like?"
- "How do you handle production incidents?"
- "What's the onboarding process for new engineers?"

**About the company:**
- "What excites you most about the company's direction?"
- "How do you approach work-life balance?"
- "What's your favorite thing about working here?"

**Red flags to watch for:**
- They can't articulate what you'd work on
- Team sounds burnt out or toxic
- No clear onboarding plan
- Unrealistic timelines ("we need to ship in 2 weeks")

---

<a name="action-plan"></a>
## 8. Week-by-Week Action Plan

### Week 1: Foundation

**Monday:**
- [ ] Fix resume (remove/correct Integuru, rewrite project section)
- [ ] Make assistantapp repo public
- [ ] Remove any API keys/secrets from code

**Tuesday:**
- [ ] Write killer README.md for assistantapp
- [ ] Create spreadsheet of hackathon connections
- [ ] Send follow-up messages to 5 people

**Wednesday:**
- [ ] Record 2-minute demo video
- [ ] Upload to YouTube
- [ ] Add to GitHub README

**Thursday:**
- [ ] Start LeetCode (do 3 easy problems)
- [ ] Make list of 30 target companies (YC, Wellfound, etc.)
- [ ] Research 10 companies (5 min each)

**Friday:**
- [ ] Apply to 5 companies with customized cover letters
- [ ] Do 2 LeetCode mediums
- [ ] Update tracking spreadsheet

**Weekend:**
- [ ] Go to hackathon/meetup
- [ ] Meet 3-5 new people
- [ ] Continue LeetCode practice (2 problems per day)

### Week 2: Momentum

**Monday-Friday:**
- [ ] Apply to 10 companies (2 per day)
- [ ] LeetCode daily (2 mediums per day)
- [ ] Send 3 networking messages to hackathon connections
- [ ] Follow up with week 1 applications (if no response)

**Weekend:**
- [ ] Go to another hackathon/meetup
- [ ] Continue LeetCode
- [ ] Prepare STAR stories (write them out)

### Week 3-4: Interview Prep

**By now you should start getting responses.**

**Daily routine:**
- [ ] 1-2 LeetCode mediums
- [ ] Apply to 2 new companies
- [ ] Send 1-2 networking messages
- [ ] Update tracking spreadsheet

**When you get a phone screen:**
- [ ] Research company thoroughly (30 min)
- [ ] Practice "tell me about yourself"
- [ ] Prepare "why this company" answer
- [ ] Prepare 3 questions to ask them

**When you get a technical interview:**
- [ ] Do 3-4 mock interviews with friend or Pramp
- [ ] Review LeetCode patterns
- [ ] Practice talking through your thought process

### Week 5-8: Active Interviewing

**At this point:**
- [ ] You should have 50+ applications out
- [ ] 5-10 phone screens completed or scheduled
- [ ] 2-3 technical interviews scheduled
- [ ] Continue applying to new companies (pipeline)

**Interview cadence:**
- Some weeks you'll have 3-4 interviews
- Some weeks you'll have none
- Keep applying to maintain pipeline

**After each interview:**
- [ ] Send thank-you email within 24 hours
- [ ] Note what went well / poorly
- [ ] Update prep materials based on learnings

### Week 9-12: Closing

**If you have offers:**
- [ ] Negotiate (always ask for more)
- [ ] Compare offers (salary, equity, learning, team)
- [ ] Make decision

**If you don't have offers yet:**
- [ ] Review what's not working (resume? interview performance? targeting?)
- [ ] Adjust strategy
- [ ] Double down on networking (highest ROI)
- [ ] Keep grinding

---

<a name="message-templates"></a>
## 9. Message Templates

### Template 1: Hackathon Follow-Up (Same Day)

**Use when:** You just met someone at an event

```
Hey [Name], great meeting you at [Event Name] today! Really enjoyed
hearing about [specific thing they mentioned - their project, their
company, a technical challenge they discussed].

I'm working on [your project in 1 sentence] - would love to share
more if you're interested. Also happy to chat about [topic you
discussed] anytime.

Hope to see you at the next one!

- Edward
```

### Template 2: Warm Intro Request

**Use when:** You've built rapport and want them to introduce you to their company

```
Hey [Name], hope you're doing well! I'm starting my job search and
[Their Company] is high on my list because [specific reason].

I know you're on the eng team there. Any chance you'd be comfortable
referring me or introducing me to [hiring manager name if you know it,
otherwise "someone on the hiring team"]?

Happy to send you my resume and GitHub link. I think the assistantapp
project demonstrates I can ship quality code, even though I'm early in
my career.

No worries if not - I know you're busy!

- Edward
```

### Template 3: Asking for Advice (Founder/Senior Engineer)

**Use when:** You want advice, not a job directly

```
Hey [Name], I really valued your perspective on [topic] when we met
at [Event]. As I'm starting my job search as a junior engineer with a
strong technical project, I'd love to get your advice on positioning
myself effectively.

Would you have 15-20 minutes for a quick call sometime this week or
next? Happy to work around your schedule.

I know your time is valuable - I'd really appreciate any insights!

- Edward
```

### Template 4: Mutual Accountability (Other Job Seekers)

**Use when:** You meet someone else looking for jobs

```
Hey [Name], sounds like we're both in job search mode! Want to set up
a weekly call to:
- Share job leads we find
- Practice technical interviews together
- Keep each other accountable

I find it way easier to stay motivated with someone else in the same boat.
Let me know if you're interested!

- Edward
```

### Template 5: Following Up After No Response (1 Week)

**Use when:** You applied but haven't heard back

```
Subject: Following up - Edward Zhong - [Job Title]

Hi [Hiring Manager / Team],

I applied for the [Job Title] position last week and wanted to follow up.
I'm genuinely excited about [Company]'s work on [specific thing].

I recently built an AI assistant (GitHub: [link] + demo video: [link])
that demonstrates relevant skills for this role - production TypeScript,
system architecture, and full-stack development.

Would love to chat if you're still considering candidates.

Best,
Edward Zhong
edwardrzhong@gmail.com
github.com/ezhong0
```

### Template 6: Thank You After Interview

**Use when:** After any interview (recruiter screen, technical, behavioral)

```
Subject: Thank you - [Job Title] interview

Hi [Interviewer Name],

Thank you for taking the time to speak with me [today/yesterday] about
the [Job Title] position. I really enjoyed [specific thing - learning
about the team's approach to X, discussing the technical challenges
with Y, etc.].

[Optional: If something came up in the interview] Our discussion about
[topic] got me thinking about [insight or idea]. I'd love to explore
that further if I move forward in the process.

I'm very excited about the possibility of joining [Company] and
contributing to [specific thing they're working on].

Please let me know if you need anything else from me.

Best,
Edward Zhong
```

### Template 7: Accepting a Referral Graciously

**Use when:** Someone agrees to refer you

```
Hey [Name], thank you so much for being willing to refer me to [Company]!
I really appreciate it.

Here's my info:
- Resume: [attach]
- GitHub: github.com/ezhong0
- LinkedIn: linkedin.com/in/edwardzhong0
- Demo video: [link]

For context on what to say (if needed):
"Edward is a recent CS grad I met at [event]. He built an impressive
AI assistant project that shows strong system design and code quality.
Looking for his first full-time role."

Let me know if you need anything else from me. Thanks again!

- Edward
```

---

<a name="reality-check"></a>
## 10. Reality Check & Expectations

### Timeline Expectations

**Realistic timeline to first offer: 1-3 months**

**Breakdown:**
- Week 1-2: Prep (resume, GitHub, demo video)
- Week 3-6: Heavy application phase (50-100 apps)
- Week 4-8: Phone screens start coming in
- Week 6-10: Technical interviews
- Week 8-12: Offers (if you execute well)

**Variables that affect timeline:**
- Market conditions (2025 is tough)
- Your interview performance (practice helps)
- Luck (right place, right time)
- Network strength (warm intros move faster)

### Success Metrics

**Good outcomes:**
- 50-100 applications → 10+ phone screens → 3-5 onsites → 1-2 offers
- Offer in the $80-120K range
- Company 10-100 people, seed to Series B
- Role: Junior/Mid-Level Engineer

**Great outcomes:**
- 30-50 applications → 15 phone screens → 5 onsites → 2-3 offers
- Offer in the $100-130K range
- Company you're genuinely excited about
- Strong engineering team to learn from

**Struggle signals:**
- 100 applications → 0-2 phone screens
  - **Problem:** Resume/GitHub not compelling, or you're applying to wrong companies
  - **Fix:** Get resume reviewed, improve project presentation, target earlier-stage startups

- 10 phone screens → 0-1 technical interviews
  - **Problem:** Not passing recruiter screens
  - **Fix:** Practice "tell me about yourself", improve storytelling, show more enthusiasm

- 5 technical interviews → 0 onsites
  - **Problem:** Not solving coding problems well enough
  - **Fix:** More LeetCode practice, do mock interviews, work on communication

### Salary Expectations

**For your level (junior/mid with strong project but no full-time experience):**

**Seed-stage startups (10-30 people):**
- Base: $80-110K
- Equity: 0.1-0.5%
- Risk: High (might fail)
- Learning: Very high (wearing many hats)

**Series A (30-100 people):**
- Base: $100-130K
- Equity: 0.05-0.2%
- Risk: Medium
- Learning: High (still growing fast)

**Series B+ (100-200 people):**
- Base: $110-140K
- Equity: 0.01-0.1%
- Risk: Lower
- Learning: Medium (more specialized roles)

**What you WON'T get:**
- FAANG new grad salary ($150-200K+ total comp)
- Senior engineer salary ($160-220K)
- Significant equity unless founding engineer

**What to optimize for:**
1. **Learning** (work with great engineers, challenging problems)
2. **Growth potential** (clear path to mid/senior)
3. **Reasonable salary** (enough to live without stress)
4. Equity (nice to have, but unlikely to matter)

### What Will Be Hard

**Be prepared for:**

1. **Lots of rejection**
   - 95% of applications will go nowhere
   - You'll get ghosted constantly
   - You'll fail interviews you thought went well
   - **This is normal. Don't take it personally.**

2. **Imposter syndrome**
   - "Everyone else seems more qualified"
   - "I don't deserve to be here"
   - "They're going to find out I'm not that good"
   - **Everyone feels this. Your project is impressive. You belong.**

3. **The gap question**
   - They will ask about 2023-2025
   - It will feel uncomfortable
   - **Have your answer ready. Say it confidently. Move on.**

4. **Interview pressure**
   - Your mind will blank on easy problems
   - You'll make silly mistakes
   - You'll compare yourself to others
   - **Practice helps. Mock interviews help. It gets easier.**

5. **Uncertainty**
   - "Am I doing this right?"
   - "Should I apply to more companies or focus on interview prep?"
   - "Is this going to work?"
   - **Trust the process. Keep executing. It works if you work it.**

### What Will Make This Easier

**Support system:**
- Talk to friends/family about the search
- Join communities (Hacker News, Reddit r/cscareerquestions)
- Find accountability partners (other job seekers)
- Celebrate small wins (got a phone screen! solved a hard LC problem!)

**Routine:**
- Set daily/weekly goals (10 applications this week)
- Track progress (use spreadsheets)
- Schedule it (9-11am = applications, 11-1pm = LeetCode, 2-4pm = networking)
- Take breaks (you'll burn out if you don't)

**Perspective:**
- You only need ONE company to say yes
- Rejection from Company A doesn't affect Company B
- This is a skills-building process, not just a job search
- Even if it takes 3-4 months, you'll be employed

### When to Pivot Strategy

**If after 6-8 weeks you have:**
- 80+ applications, 0-2 phone screens
  - **Pivot:** Resume needs work, or you're targeting wrong companies

- 10+ phone screens, 0-1 technical interviews
  - **Pivot:** Work on storytelling and recruiter screen performance

- 5+ technical interviews, 0 onsites
  - **Pivot:** More LeetCode practice, mock interviews

**Don't pivot strategy after just 2-3 weeks.** The process is slow.

### The Most Important Thing

**Consistency beats intensity.**

Applying to 5 companies a day for 20 days > applying to 50 companies in one manic weekend then nothing for 2 weeks.

Doing 2 LeetCode problems a day for 30 days > doing 15 problems in one day then burning out.

**Show up every day. Do the work. Trust the process.**

---

## Final Thoughts

You asked if I think you can get a job. **Yes, you can.**

**Not because the market is easy.** It's not.

**Not because you're a senior engineer.** You're not.

**But because:**
1. You can build impressive things (the codebase proves it)
2. You're willing to put in the work (you worked through executive function challenges)
3. You're already networking (hackathons, meeting people)
4. You're asking the right questions (how to position yourself, how to follow up)
5. You have a CS degree from a good school
6. You're in the Bay Area (highest density of startup jobs)

**What you need to do:**
1. **Fix the resume** (be honest, highlight the project)
2. **Make GitHub shine** (public repo, great README, demo video)
3. **Leverage your network** (follow up with hackathon connections)
4. **Apply strategically** (50-100 startups, not FAANG)
5. **Prepare for interviews** (LeetCode, STAR stories, system design basics)
6. **Stay consistent** (daily routine, track progress, don't give up)

**The job search is a job.** Treat it like one. 6-8 hours a day:
- 2 hours: applications
- 2 hours: LeetCode
- 2 hours: networking/follow-ups
- 2 hours: interview prep/learning

**Do this for 8-12 weeks and you'll have an offer.**

Not a guarantee, but very high probability if you execute.

---

**You've got this. Now go get it.**

---

## Quick Reference Checklist

**This Week:**
- [ ] Fix resume (honest work history, rewrite project section)
- [ ] Make assistantapp public, write README, record demo video
- [ ] Create tracking spreadsheet (applications + network)
- [ ] Follow up with 5 hackathon connections
- [ ] Apply to 5 companies
- [ ] Start LeetCode (3 problems)

**This Month:**
- [ ] Apply to 30-50 companies
- [ ] Do 30-40 LeetCode problems
- [ ] Attend 2 hackathons/meetups
- [ ] Get 3-5 warm intros
- [ ] Get 3-5 phone screens
- [ ] Practice STAR stories

**Next 3 Months:**
- [ ] 80-100 applications
- [ ] 10+ phone screens
- [ ] 3-5 technical interviews
- [ ] 1-2 offers
- [ ] Accept offer, start job

---

**Questions? Stuck? Discouraged?**

Re-read this doc. The answer is probably here.

If not, reach out to someone in your network for advice.

**You're not alone in this. Every engineer went through this process.**

**Keep going.**
