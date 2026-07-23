"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import SharedFooter from "@/app/components/SharedFooter";
import {
  X,
  Calendar,
  Clock,
  ArrowRight,
  Tag,
  GitBranch,
  Rocket,
  Users,
  Shield,
  Zap,
  TrendingUp,
  Code,
  Database,
  Activity,
  Terminal,
  Lock,
  GitMerge,
  BarChart3,
  Layers,
  Cloud,
  Cpu,
  Globe,
} from "lucide-react";

interface BlogPost {
  id: number;
  title: string;
  description: string;
  badge: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  content: string;
  author: {
    name: string;
    role: string;
  };
}

const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Enterprise-Grade Version Control for Modern Teams",
    description:
      "Discover how Gent revolutionizes code management with advanced security, real-time collaboration, and seamless CI/CD integration.",
    badge: "Product",
    category: "product",
    date: "Jan 15, 2026",
    readTime: "5 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Sarah Johnson",
      role: "Chief Product Officer",
    },
    content: `
# Enterprise-Grade Version Control for Modern Teams

In today's fast-paced development landscape, teams need more than just basic version control. They need a platform that scales with their ambitions, secures their intellectual property, and accelerates their delivery pipeline.

## Why Traditional Solutions Fall Short

Legacy version control systems were built for a different era. They struggle with:

- **Scalability Challenges**: Slow performance with large repositories
- **Complex Workflows**: Steep learning curves that slow down teams
- **Security Gaps**: Insufficient access controls and audit trails
- **Integration Friction**: Limited compatibility with modern DevOps tools

## The Gent Approach

Gent was designed from the ground up to address these challenges:

### 1. Lightning-Fast Performance
Our distributed architecture ensures sub-second response times, even with repositories containing millions of commits. We achieve this through:
- Intelligent caching mechanisms
- Optimized data structures
- Edge computing distribution

### 2. Enterprise Security
Security isn't an afterthought—it's built into every layer:
- End-to-end encryption for data in transit and at rest
- Role-based access controls with granular permissions
- Complete audit logs for compliance requirements
- SOC 2 Type II certified infrastructure

### 3. Seamless Integration
Gent plays well with your existing tools:
- Native integration with popular CI/CD platforms
- Webhook support for custom workflows
- REST and GraphQL APIs for extensibility
- Pre-built plugins for major IDEs

## Real-World Impact

Organizations using Gent report:
- 40% reduction in merge conflicts
- 60% faster code review cycles
- 99.99% uptime reliability
- 50% decrease in security incidents

## Getting Started

Migrating to Gent is straightforward:
1. Connect your existing repositories
2. Configure team permissions
3. Set up automated workflows
4. Train your team with our onboarding resources

The future of version control is here. Are you ready?
    `,
  },
  {
    id: 2,
    title: "Streamlining DevOps: From Commit to Deployment",
    description:
      "Learn how to build a robust CI/CD pipeline that reduces deployment time from hours to minutes while maintaining quality and security.",
    badge: "DevOps",
    category: "devops",
    date: "Jan 10, 2026",
    readTime: "7 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Marcus Chen",
      role: "Head of DevOps",
    },
    content: `
# Streamlining DevOps: From Commit to Deployment

Modern software development demands speed without sacrificing quality. Organizations that master their DevOps pipeline gain a significant competitive advantage.

## The Traditional Deployment Problem

Many teams still struggle with:
- Manual deployment processes prone to human error
- Hours-long release cycles
- Inconsistent environments between staging and production
- Lack of visibility into deployment status

## Building an Efficient Pipeline

### Stage 1: Automated Testing
Every commit triggers a comprehensive test suite:
- Unit tests for code correctness
- Integration tests for component interaction
- Security scans for vulnerability detection
- Performance tests for regression prevention

### Stage 2: Continuous Integration
Gent automatically:
- Builds artifacts from your code
- Runs quality checks
- Generates deployment packages
- Stores versioned releases

### Stage 3: Deployment Automation
Deploy with confidence using:
- Blue-green deployments for zero-downtime
- Canary releases for gradual rollouts
- Automatic rollback on failure detection
- Environment-specific configurations

## Monitoring and Observability

Track your deployments with:
- Real-time deployment dashboards
- Automated health checks
- Performance metrics collection
- Incident alerting and notifications

## Best Practices

1. **Fail Fast**: Catch issues early in the pipeline
2. **Automate Everything**: Remove manual intervention
3. **Monitor Continuously**: Track metrics and logs
4. **Document Thoroughly**: Maintain clear runbooks

## Results

Teams implementing these practices see:
- 80% reduction in deployment time
- 90% fewer deployment failures
- Increased developer productivity
- Higher customer satisfaction

Start optimizing your pipeline today with Gent's integrated DevOps tools.
    `,
  },
  {
    id: 3,
    title: "Security Best Practices for Code Repositories",
    description:
      "Protect your codebase with industry-leading security practices. Learn about access control, encryption, and compliance frameworks.",
    badge: "Security",
    category: "security",
    date: "Jan 5, 2026",
    readTime: "6 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Dr. Emily Rodriguez",
      role: "Chief Security Officer",
    },
    content: `
# Security Best Practices for Code Repositories

Your code is your company's most valuable asset. Protecting it requires a multi-layered security approach that addresses both technical and organizational challenges.

## The Threat Landscape

Modern development faces numerous security challenges:
- Insider threats from compromised credentials
- Supply chain attacks through dependencies
- Data breaches exposing sensitive information
- Compliance violations risking legal penalties

## Foundational Security Measures

### 1. Access Control
Implement the principle of least privilege:
- Role-based permissions for team members
- Multi-factor authentication enforcement
- Regular access audits and reviews
- Automated provisioning and deprovisioning

### 2. Encryption
Protect data at every stage:
- TLS 1.3 for all data in transit
- AES-256 encryption for data at rest
- Key rotation and management
- Secure backup procedures

### 3. Audit and Compliance
Maintain detailed records:
- Complete audit trails of all actions
- Regular security assessments
- Compliance with SOC 2, ISO 27001, GDPR
- Automated compliance reporting

## Advanced Security Features

### Secret Management
Never expose sensitive data:
- Encrypted environment variables
- Secure credential storage
- Automatic secret rotation
- Leak detection and alerts

### Vulnerability Scanning
Stay ahead of threats:
- Automated dependency scanning
- Known vulnerability databases
- Security patch notifications
- Remediation guidance

### Code Analysis
Identify issues before they ship:
- Static application security testing (SAST)
- Dynamic application security testing (DAST)
- Code quality enforcement
- Custom security rules

## Incident Response

Be prepared for security events:
1. **Detection**: Automated monitoring and alerting
2. **Response**: Predefined incident playbooks
3. **Containment**: Quick isolation procedures
4. **Recovery**: Tested backup and restore processes
5. **Learning**: Post-incident analysis and improvements

## Security Culture

Technology alone isn't enough:
- Regular security training for all team members
- Security champions within development teams
- Clear escalation procedures
- Open communication about security concerns

## Gent Security Commitment

We take security seriously:
- 24/7 security operations center
- Regular penetration testing
- Bug bounty program
- Transparent security disclosures

Secure your codebase with Gent's enterprise-grade security features.
    `,
  },
  {
    id: 4,
    title: "Scaling Development Teams: Collaboration at Scale",
    description:
      "Manage growing engineering teams effectively. Discover strategies for maintaining productivity and code quality as your organization expands.",
    badge: "Team Management",
    category: "team",
    date: "Dec 28, 2025",
    readTime: "8 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "David Park",
      role: "VP of Engineering",
    },
    content: `
# Scaling Development Teams: Collaboration at Scale

As organizations grow, maintaining effective collaboration becomes increasingly challenging. The strategies that worked for a team of 10 often break down at 100 or 1000 developers.

## The Scaling Challenge

Common pain points include:
- Communication overhead increasing exponentially
- Knowledge silos forming across teams
- Inconsistent processes and tooling
- Difficult code review backlogs
- Merge conflicts and integration issues

## Organizational Strategies

### Team Structure
Optimize your organization:
- Autonomous, cross-functional teams
- Clear ownership and accountability
- Defined interfaces between teams
- Regular cross-team communication

### Process Standardization
Create consistency without stifling innovation:
- Documented coding standards
- Standardized development workflows
- Shared best practices libraries
- Regular process reviews and improvements

### Knowledge Management
Keep information flowing:
- Comprehensive documentation
- Code comments and README files
- Architecture decision records
- Regular knowledge sharing sessions

## Technical Solutions

### Monorepo vs. Multirepo
Choose the right structure:
- Monorepo benefits: Shared code, atomic changes
- Multirepo benefits: Independent deployment, clear boundaries
- Hybrid approaches for maximum flexibility

### Code Ownership
Implement CODEOWNERS files:
- Automatic reviewer assignment
- Required approvals from owners
- Clear responsibility boundaries
- Faster code review cycles

### Automated Workflows
Reduce manual overhead:
- Automated testing and validation
- Continuous integration pipelines
- Deployment automation
- Automated documentation generation

## Communication Patterns

### Asynchronous Communication
Respect global teams:
- Detailed pull request descriptions
- Threaded code review discussions
- Recorded decision-making processes
- Written status updates

### Synchronous Collaboration
When real-time matters:
- Daily standup meetings
- Pair programming sessions
- Architecture discussions
- Incident response coordination

## Metrics That Matter

Track team effectiveness:
- Cycle time from commit to deployment
- Pull request review time
- Deployment frequency
- Change failure rate
- Mean time to recovery

## Building Culture

Foster collaboration through:
- Recognition programs
- Cross-team rotations
- Hackathons and innovation time
- Open source contributions

## Gent's Collaboration Tools

We provide:
- Real-time activity feeds
- Integrated code review
- Team analytics and insights
- Communication integrations

Scale your team confidently with Gent's collaboration platform.
    `,
  },
  {
    id: 5,
    title: "Cloud-Native Architecture: Building for Scale",
    description:
      "Explore how cloud-native design patterns enable unlimited scalability, high availability, and cost efficiency for modern applications.",
    badge: "Architecture",
    category: "architecture",
    date: "Dec 20, 2025",
    readTime: "6 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Alex Kumar",
      role: "Solutions Architect",
    },
    content: `
# Cloud-Native Architecture: Building for Scale

The shift to cloud-native architecture represents a fundamental change in how we design and deploy applications. It's not just about moving to the cloud—it's about building systems that leverage cloud capabilities to their fullest.

## Understanding Cloud-Native Principles

Cloud-native applications are designed to:
- Scale horizontally with minimal effort
- Recover automatically from failures
- Update without downtime
- Optimize resource utilization

### Microservices Architecture
Break monoliths into manageable services:
- Independent deployment cycles
- Technology diversity
- Isolated failure domains
- Team autonomy

### Containerization
Package applications consistently:
- Docker for containerization
- Kubernetes for orchestration
- Consistent environments
- Resource efficiency

## Infrastructure as Code

Manage infrastructure programmatically:
- Version-controlled infrastructure
- Reproducible environments
- Automated provisioning
- Compliance as code

## Observability and Monitoring

Understand system behavior:
- Distributed tracing
- Centralized logging
- Metrics collection
- Real-time alerting

## Best Practices

1. **Design for Failure**: Assume components will fail
2. **Automate Everything**: Reduce manual intervention
3. **Optimize Costs**: Monitor and adjust resource usage
4. **Security First**: Implement security at every layer

Embrace cloud-native with Gent's modern infrastructure.
    `,
  },
  {
    id: 6,
    title: "API-First Development: Building Connected Systems",
    description:
      "Master API design and implementation strategies that enable seamless integration, scalability, and developer-friendly interfaces.",
    badge: "Development",
    category: "development",
    date: "Dec 15, 2025",
    readTime: "7 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Jordan Martinez",
      role: "API Architect",
    },
    content: `
# API-First Development: Building Connected Systems

In today's interconnected world, APIs are the backbone of modern software. An API-first approach ensures your systems are built for integration from day one.

## Why API-First?

APIs enable:
- Third-party integrations
- Mobile and web applications
- Internal service communication
- Partner ecosystems

### RESTful Design Principles

Build intuitive APIs:
- Resource-based URLs
- HTTP methods for actions
- Stateless operations
- JSON responses

### GraphQL Advantages

Modern query language:
- Client-specified data
- Single endpoint
- Strong typing
- Real-time subscriptions

## API Documentation

Clear documentation is crucial:
- OpenAPI/Swagger specs
- Interactive examples
- Code samples
- Versioning strategy

## Security Considerations

Protect your APIs:
- OAuth 2.0 authentication
- Rate limiting
- Input validation
- HTTPS everywhere

## Performance Optimization

Ensure fast responses:
- Caching strategies
- Pagination
- Compression
- CDN integration

Build powerful APIs with Gent's development tools.
    `,
  },
  {
    id: 7,
    title: "Performance Optimization: Speed at Every Layer",
    description:
      "Learn advanced techniques for optimizing application performance, from database queries to frontend rendering and caching strategies.",
    badge: "Performance",
    category: "performance",
    date: "Dec 10, 2025",
    readTime: "8 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Lisa Wong",
      role: "Performance Engineer",
    },
    content: `
# Performance Optimization: Speed at Every Layer

Performance isn't just about speed—it's about user experience, cost efficiency, and competitive advantage. Every millisecond counts.

## Frontend Optimization

Deliver fast-loading interfaces:
- Code splitting and lazy loading
- Image optimization
- Critical CSS
- Resource compression

### JavaScript Performance

Optimize execution:
- Minimize bundle sizes
- Tree shaking
- Web workers
- Service workers

## Backend Optimization

Server-side efficiency:
- Database query optimization
- Connection pooling
- Asynchronous processing
- Efficient algorithms

### Caching Strategies

Reduce redundant work:
- CDN caching
- Application-level caching
- Database query caching
- Redis/Memcached

## Database Performance

Optimize data access:
- Proper indexing
- Query optimization
- Connection management
- Sharding and replication

## Monitoring and Profiling

Identify bottlenecks:
- Application Performance Monitoring (APM)
- Real User Monitoring (RUM)
- Synthetic monitoring
- Load testing

## Best Practices

1. **Measure First**: Profile before optimizing
2. **Optimize Critical Paths**: Focus on user-facing operations
3. **Test Under Load**: Simulate real-world conditions
4. **Monitor Continuously**: Track performance metrics

Optimize your applications with Gent's performance tools.
    `,
  },
  {
    id: 8,
    title: "Continuous Integration: Automating Your Workflow",
    description:
      "Implement robust CI practices that catch bugs early, speed up development cycles, and maintain code quality across your team.",
    badge: "CI/CD",
    category: "cicd",
    date: "Dec 5, 2025",
    readTime: "6 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Ryan Foster",
      role: "DevOps Lead",
    },
    content: `
# Continuous Integration: Automating Your Workflow

Continuous Integration transforms how teams deliver software. Automate testing, validation, and integration to ship with confidence.

## CI Fundamentals

Core principles:
- Commit frequently
- Automated builds
- Self-testing code
- Fast feedback loops

### Build Pipeline

Structure your pipeline:
- Source code checkout
- Dependency installation
- Compilation/transpilation
- Test execution
- Artifact generation

## Testing Strategy

Comprehensive test coverage:
- Unit tests for components
- Integration tests for services
- End-to-end tests for workflows
- Performance tests

### Quality Gates

Enforce standards:
- Code coverage thresholds
- Linting and formatting
- Security scans
- Code complexity checks

## Artifact Management

Handle build outputs:
- Version tagging
- Artifact repository
- Dependency management
- Release preparation

## Notifications and Reporting

Keep teams informed:
- Build status notifications
- Test failure reports
- Coverage reports
- Deployment status

## Best Practices

1. **Keep Builds Fast**: Optimize for quick feedback
2. **Fix Broken Builds Immediately**: Maintain green status
3. **Automate Everything**: Reduce manual steps
4. **Version Everything**: Track all changes

Automate your workflow with Gent's CI/CD platform.
    `,
  },
];

export default function HowItWorksPage() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filters = [
    { id: "all", label: "All Articles", icon: Activity },
    { id: "product", label: "Product", icon: Rocket },
    { id: "devops", label: "DevOps", icon: Terminal },
    { id: "security", label: "Security", icon: Lock },
    { id: "team", label: "Team", icon: Users },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "development", label: "Development", icon: Code },
    { id: "performance", label: "Performance", icon: Zap },
    { id: "cicd", label: "CI/CD", icon: GitMerge },
  ];

  const filteredPosts =
    selectedFilter === "all"
      ? blogPosts
      : blogPosts.filter((post) => post.category === selectedFilter);

  // UI mockup component for each category
  const getUIComponent = (category: string) => {
    const baseClasses = `w-full h-full rounded-lg p-4 ${
      isDark ? "bg-[#0f1419]" : "bg-gray-900"
    }`;

    switch (category) {
      case "product":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="text-[#7dd3fc] text-xs font-mono">
                  gent-platform
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#7dd3fc]" />
                  <div className="h-2 bg-[#7dd3fc]/20 rounded flex-1"></div>
                  <div className="text-xs text-gray-400">main</div>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  <div className="h-2 bg-emerald-400/20 rounded flex-1"></div>
                  <div className="text-xs text-gray-400">156 files</div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <div className="h-2 bg-purple-400/20 rounded w-2/3"></div>
                  <div className="text-xs text-gray-400">12 members</div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded bg-[#7dd3fc]/10 border border-[#7dd3fc]/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse"></div>
                  <span className="text-xs text-[#7dd3fc]">Latest commit</span>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  feat: add new dashboard
                </div>
              </div>
            </div>
          </div>
        );

      case "devops":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  CI/CD Pipeline
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-emerald-400 mb-1">
                      Build Complete
                    </div>
                    <div className="h-1 bg-emerald-500/20 rounded">
                      <div className="h-full w-full bg-emerald-500 rounded"></div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">2m 34s</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#7dd3fc]/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-[#7dd3fc] mb-1">
                      Running Tests
                    </div>
                    <div className="h-1 bg-[#7dd3fc]/20 rounded">
                      <div className="h-full w-3/4 bg-[#7dd3fc] rounded"></div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">1m 12s</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                      Deploy to Production
                    </div>
                    <div className="h-1 bg-gray-700/50 rounded"></div>
                  </div>
                  <span className="text-xs text-gray-500">Pending</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Security Dashboard
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-400">98%</div>
                  <div className="text-xs text-gray-400">Security Score</div>
                </div>
                <div className="p-2 rounded bg-[#7dd3fc]/10 border border-[#7dd3fc]/20">
                  <div className="text-2xl font-bold text-[#7dd3fc]">0</div>
                  <div className="text-xs text-gray-400">Critical Issues</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-gray-300">2FA Enabled</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-gray-300">
                      SSL Certificate
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-gray-300">
                      Encrypted Backups
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                </div>
              </div>
            </div>
          </div>
        );

      case "team":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Team Analytics
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 rounded bg-[#7dd3fc]/10 text-center">
                  <div className="text-xl font-bold text-[#7dd3fc]">24</div>
                  <div className="text-xs text-gray-400">Members</div>
                </div>
                <div className="p-2 rounded bg-purple-500/10 text-center">
                  <div className="text-xl font-bold text-purple-400">156</div>
                  <div className="text-xs text-gray-400">Commits</div>
                </div>
                <div className="p-2 rounded bg-emerald-500/10 text-center">
                  <div className="text-xl font-bold text-emerald-400">89%</div>
                  <div className="text-xs text-gray-400">Uptime</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Sarah J.", commits: 45, color: "bg-[#7dd3fc]" },
                  { name: "Marcus C.", commits: 38, color: "bg-purple-400" },
                  { name: "Emily R.", commits: 32, color: "bg-emerald-400" },
                ].map((member, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full ${member.color}/20 flex items-center justify-center`}
                    >
                      <span className="text-xs font-semibold text-white">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">
                          {member.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {member.commits}
                        </span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded">
                        <div
                          className={`h-full ${member.color} rounded`}
                          style={{ width: `${member.commits}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "architecture":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  System Architecture
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded bg-[#7dd3fc]/10 border border-[#7dd3fc]/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#7dd3fc] font-semibold">
                      API Gateway
                    </span>
                    <Cloud className="w-3 h-3 text-[#7dd3fc]" />
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 bg-[#7dd3fc] rounded"
                      ></div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                    <Database className="w-3 h-3 text-purple-400 mb-1" />
                    <div className="text-xs text-purple-400">Database</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <Cpu className="w-3 h-3 text-emerald-400 mb-1" />
                    <div className="text-xs text-emerald-400">Services</div>
                  </div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-xs text-gray-400">
                      Load Balancer Active
                    </span>
                  </div>
                  <div className="h-1 bg-gray-700 rounded">
                    <div className="h-full w-3/4 bg-emerald-400 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "development":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Code className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  API Development
                </span>
              </div>
              <div className="p-3 rounded bg-white/5 font-mono text-xs">
                <div className="text-purple-400 mb-1">POST /api/users</div>
                <div className="text-gray-500 mb-2">{"{"}</div>
                <div className="pl-4 space-y-1">
                  <div>
                    <span className="text-[#7dd3fc]">"name"</span>:{" "}
                    <span className="text-emerald-400">"John"</span>,
                  </div>
                  <div>
                    <span className="text-[#7dd3fc]">"email"</span>:{" "}
                    <span className="text-emerald-400">"j@ex.com"</span>
                  </div>
                </div>
                <div className="text-gray-500">{"}"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-emerald-500/10">
                  <div className="text-lg font-bold text-emerald-400">200</div>
                  <div className="text-xs text-gray-400">Success Rate</div>
                </div>
                <div className="p-2 rounded bg-[#7dd3fc]/10">
                  <div className="text-lg font-bold text-[#7dd3fc]">45ms</div>
                  <div className="text-xs text-gray-400">Avg Response</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "performance":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Performance Metrics
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded bg-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-400">98</div>
                  <div className="text-xs text-gray-400">Performance Score</div>
                </div>
                <div className="p-2 rounded bg-[#7dd3fc]/10">
                  <div className="text-2xl font-bold text-[#7dd3fc]">1.2s</div>
                  <div className="text-xs text-gray-400">Load Time</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "FCP", value: 85, color: "bg-emerald-400" },
                  { label: "LCP", value: 92, color: "bg-[#7dd3fc]" },
                  { label: "TTI", value: 78, color: "bg-purple-400" },
                ].map((metric, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">
                        {metric.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {metric.value}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
                      <div
                        className={`h-full ${metric.color} rounded`}
                        style={{ width: `${metric.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "cicd":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <GitMerge className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  CI/CD Status
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded bg-emerald-500/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <div className="flex-1">
                    <div className="text-xs text-emerald-400 font-semibold">
                      Build Passed
                    </div>
                    <div className="text-xs text-gray-500">
                      #1234 - main branch
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">2m ago</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-[#7dd3fc]/10">
                  <div className="w-2 h-2 rounded-full bg-[#7dd3fc] animate-pulse"></div>
                  <div className="flex-1">
                    <div className="text-xs text-[#7dd3fc] font-semibold">
                      Deploying
                    </div>
                    <div className="text-xs text-gray-500">
                      Production environment
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">Now</span>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Success Rate</span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      96%
                    </span>
                  </div>
                  <div className="h-1 bg-gray-700 rounded overflow-hidden">
                    <div className="h-full w-[96%] bg-emerald-400 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Team Analytics
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 rounded bg-[#7dd3fc]/10 text-center">
                  <div className="text-xl font-bold text-[#7dd3fc]">24</div>
                  <div className="text-xs text-gray-400">Members</div>
                </div>
                <div className="p-2 rounded bg-purple-500/10 text-center">
                  <div className="text-xl font-bold text-purple-400">156</div>
                  <div className="text-xs text-gray-400">Commits</div>
                </div>
                <div className="p-2 rounded bg-emerald-500/10 text-center">
                  <div className="text-xl font-bold text-emerald-400">89%</div>
                  <div className="text-xs text-gray-400">Uptime</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Sarah J.", commits: 45, color: "bg-[#7dd3fc]" },
                  { name: "Marcus C.", commits: 38, color: "bg-purple-400" },
                  { name: "Emily R.", commits: 32, color: "bg-emerald-400" },
                ].map((member, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full ${member.color}/20 flex items-center justify-center`}
                    >
                      <span className="text-xs font-semibold text-white">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">
                          {member.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {member.commits}
                        </span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded">
                        <div
                          className={`h-full ${member.color} rounded`}
                          style={{ width: `${member.commits}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={baseClasses}>
            <div className="w-full h-full flex items-center justify-center">
              <Database
                className={`w-16 h-16 ${isDark ? "text-[#7dd3fc]/20" : "text-gray-400"}`}
              />
            </div>
          </div>
        );
    }
  };

  if (!isHydrated) return null;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]"
          : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
      }`}
    >
      <SharedNavigation />

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 mt-20"
      >
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 ${
              isDark
                ? "bg-[#7dd3fc]/10 border-[#7dd3fc]/20 text-[#7dd3fc]"
                : "bg-white/30 border-white/50 text-[#2d3e2d]"
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span className="text-sm font-semibold">Learn How Gent Works</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-5xl md:text-6xl font-bold mb-6 ${
              isDark ? "text-white" : "text-[#2d3e2d]"
            }`}
          >
            Transform Your{" "}
            <span className={isDark ? "text-[#7dd3fc]" : "text-white"}>
              Development Workflow
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`text-xl mb-8 ${
              isDark ? "text-gray-300" : "text-[#2d3e2d]/80"
            }`}
          >
            Discover best practices, insights, and strategies from industry
            leaders. Learn how top engineering teams build, deploy, and scale
            with confidence.
          </motion.p>

          {/* Animated Icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center gap-8 mt-12"
          >
            {[GitBranch, Users, Shield, Zap, TrendingUp, Code].map(
              (Icon, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  className={`p-4 rounded-full ${
                    isDark
                      ? "bg-white/10 text-[#7dd3fc]"
                      : "bg-white/30 text-[#2d3e2d]"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
              ),
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* Blog Posts Grid */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-3 mb-12"
        >
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isActive = selectedFilter === filter.id;

            return (
              <motion.button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  isActive
                    ? isDark
                      ? "bg-[#7dd3fc] text-[#0f1419] border-[#7dd3fc] shadow-lg shadow-[#7dd3fc]/30"
                      : "bg-[#5A7863] text-white border-[#5A7863] shadow-lg"
                    : isDark
                      ? "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                      : "bg-white/30 text-[#2d3e2d] border-white/50 hover:bg-white/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Posts Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedFilter}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-8"
          >
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedPost(post)}
                className={`cursor-pointer rounded-2xl overflow-hidden border transition-all group ${
                  isDark
                    ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10 hover:border-[#7dd3fc]/30 hover:shadow-2xl hover:shadow-[#7dd3fc]/20"
                    : "bg-white/50 border-white/50 hover:border-white hover:shadow-2xl"
                }`}
                whileHover={{ y: -5 }}
              >
                {/* Badge */}
                <div className="p-6 pb-0">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      isDark
                        ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                        : "bg-[#5A7863]/20 text-[#5A7863]"
                    }`}
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    {post.badge}
                  </span>
                </div>

                {/* Image/UI Mockup */}
                <div
                  className={`m-6 rounded-xl overflow-hidden aspect-video ${
                    isDark ? "bg-[#0f1419]" : "bg-gray-200"
                  }`}
                >
                  {getUIComponent(post.category)}
                </div>

                {/* Content */}
                <div className="p-6 pt-0">
                  <h3
                    className={`text-2xl font-bold mb-3 ${
                      isDark ? "text-white" : "text-[#2d3e2d]"
                    }`}
                  >
                    {post.title}
                  </h3>

                  <p
                    className={`text-sm mb-4 line-clamp-2 ${
                      isDark ? "text-gray-400" : "text-[#4a5f4a]"
                    }`}
                  >
                    {post.description}
                  </p>

                  <div
                    className={`flex items-center justify-between text-xs ${
                      isDark ? "text-gray-500" : "text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>

                    <button
                      className={`flex items-center gap-1 font-semibold transition-all group-hover:gap-2 ${
                        isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                      }`}
                    >
                      Explore Article
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.section>

      {/* Blog Post Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border shadow-2xl ${
                isDark
                  ? "bg-[#1a1f2e] border-[#7dd3fc]/20"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPost(null)}
                className={`absolute top-4 right-4 z-10 p-2 rounded-lg transition-all ${
                  isDark
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-black/10 hover:bg-black/20 text-gray-900"
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[90vh] p-8">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                    isDark
                      ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                      : "bg-[#5A7863]/20 text-[#5A7863]"
                  }`}
                >
                  {selectedPost.badge}
                </span>

                <h2
                  className={`text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {selectedPost.title}
                </h2>

                <div
                  className={`flex items-center gap-4 mb-6 pb-6 border-b ${
                    isDark
                      ? "text-gray-400 border-white/10"
                      : "text-gray-600 border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {selectedPost.date}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {selectedPost.readTime}
                  </span>
                  <span className="ml-auto">
                    By <strong>{selectedPost.author.name}</strong>,{" "}
                    {selectedPost.author.role}
                  </span>
                </div>

                <div
                  className={`prose max-w-none ${isDark ? "prose-invert" : ""}`}
                >
                  {selectedPost.content.split("\n").map((paragraph, index) => (
                    <p
                      key={index}
                      className={`mb-4 ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SharedFooter />
    </div>
  );
}
