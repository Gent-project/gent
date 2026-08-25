"use client";

import { AUTH_PATH } from "@/routes/path";
import { GitBranch, Code2, Users, Zap, Shield, GitPullRequest, ArrowRight, Rocket, CheckCircle, Star, MessageSquare, Code, Database, Lock, Zap as ZapIcon, Cloud, GitMerge } from "lucide-react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import SharedFooter from "@/app/components/SharedFooter";
import NotificationCard from "@/app/components/NotificationCard";
import { useState, useEffect } from "react";

export default function Services() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        duration: 0.5,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: { duration: 3, repeat: Infinity },
    },
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]" 
        : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
    } text-foreground overflow-hidden pb-1`}>
      {!isHydrated ? null : (
        <>
          <SharedNavigation />

      {/* Section 1: Hero */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 mt-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div className="space-y-6" variants={itemVariants}>
            <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-lg ${
              isDark ? "text-white" : "text-[#1a2e1a]"
            }`}>
              Powerful Services for
              <span className={isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}> Your Projects</span>
            </h1>
            <p className={`text-lg leading-relaxed max-w-xl ${
              isDark ? "text-gray-300" : "text-[#2d3e2d]"
            }`}>
              Gent provides comprehensive version control and collaboration services designed to streamline your development workflow. From repository management to team collaboration, we've got everything you need.
            </p>
            <motion.div className="flex flex-col sm:flex-row gap-4 pt-4" variants={itemVariants}>
              <motion.a
                href={AUTH_PATH.LOGIN}
                className={`px-8 py-3 rounded-lg transition-all font-bold text-center flex items-center justify-center gap-2 ${
                  isDark
                    ? "bg-[#7dd3fc] text-[#0f1419] hover:shadow-xl hover:shadow-cyan-500/50"
                    : "bg-white text-[#5A7863] hover:shadow-xl"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign In <ArrowRight className="w-4 h-4" />
              </motion.a>
              <motion.button 
                className={`px-8 py-3 rounded-lg border-2 transition-all font-bold ${
                  isDark
                    ? "border-[#7dd3fc] text-[#7dd3fc] hover:bg-[#7dd3fc]/10"
                    : "border-[#2d3e2d] text-[#2d3e2d] hover:bg-[#2d3e2d]/10"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start New Project
              </motion.button>
            </motion.div>
          </motion.div>
          <motion.div 
            className="relative"
            variants={floatingVariants}
            animate="animate"
          >
            <div className={`rounded-2xl p-8 border shadow-2xl transition-colors ${
              isDark
                ? "bg-[#1a1f2e]/50 backdrop-blur-md border-white/10"
                : "bg-white/10 backdrop-blur-md border-[#2d3e2d]/20"
            }`}>
              <div className="space-y-4">
                <h3 className={`text-2xl font-bold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>Quick Start</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                    <span className={isDark ? "text-white/80" : "text-[#2d3e2d]"}>Create your account</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                    <span className={isDark ? "text-white/80" : "text-[#2d3e2d]"}>Initialize repository</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                    <span className={isDark ? "text-white/80" : "text-[#2d3e2d]"}>Start collaborating</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                    <span className={isDark ? "text-white/80" : "text-[#2d3e2d]"}>Deploy with confidence</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Section 2: Services Cards */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div className="text-center mb-16" variants={itemVariants}>
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
            isDark ? "text-white" : "text-[#2d3e2d]"
          }`}>
            Our Core Services
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${
            isDark ? "text-gray-300" : "text-[#4a5f4a]"
          }`}>
            Comprehensive solutions for modern development teams
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              badge: "Core",
              icon: Code2,
              title: "Repository Management",
              description: "Manage your code repositories with ease. Create, clone, and organize projects with our intuitive interface.",
            },
            {
              badge: "Collaboration",
              icon: Users,
              title: "Team Collaboration",
              description: "Work seamlessly with your team. Real-time updates, comments, and notifications keep everyone in sync.",
            },
            {
              badge: "Review",
              icon: GitPullRequest,
              title: "Pull Requests",
              description: "Review code changes before merging. Discuss improvements and maintain code quality standards.",
            },
            {
              badge: "Security",
              icon: Shield,
              title: "Security & Access",
              description: "Enterprise-grade security with role-based access control and encrypted repositories.",
            },
            {
              badge: "Performance",
              icon: Zap,
              title: "Lightning Fast",
              description: "Optimized for speed. Clone, commit, and push operations complete in seconds.",
            },
            {
              badge: "Integration",
              icon: Cloud,
              title: "CI/CD Integration",
              description: "Integrate with your favorite tools. Automate testing and deployment workflows.",
            },
          ].map((service, idx) => (
            <motion.div
              key={idx}
              className={`p-6 rounded-xl border transition-all ${
                isDark
                  ? "border-white/20 hover:border-white/40 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:shadow-xl"
                  : "border-[#5A7863]/30 hover:border-[#5A7863]/60 bg-white/40 backdrop-blur-sm hover:bg-white/60 hover:shadow-xl"
              }`}
              variants={itemVariants}
              whileHover={{ y: -5 }}
            >
              <div className="flex items-start justify-between mb-4">
                <service.icon className={`w-8 h-8 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  isDark
                    ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                    : "bg-[#5A7863]/20 text-[#5A7863]"
                }`}>
                  {service.badge}
                </span>
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>{service.title}</h3>
              <p className={`mb-4 ${isDark ? "text-white/70" : "text-[#2d3e2d]"}`}>{service.description}</p>
              <motion.a
                href={AUTH_PATH.LOGIN}
                className={`inline-flex items-center gap-2 font-medium transition-colors ${
                  isDark
                    ? "text-[#7dd3fc] hover:text-white"
                    : "text-[#5A7863] hover:text-[#2d3e2d]"
                }`}
                whileHover={{ x: 5 }}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </motion.a>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 3: Features Slider */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div className="text-center mb-16" variants={itemVariants}>
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
            isDark ? "text-white" : "text-[#2d3e2d]"
          }`}>
            Why Developers Choose Gent
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${
            isDark ? "text-gray-300" : "text-[#4a5f4a]"
          }`}>
            Industry-leading features that make development easier
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            {
              title: "Lightweight & Efficient",
              description: "Minimal resource usage with maximum performance. Our optimized architecture ensures fast operations.",
              icon: ZapIcon,
            },
            {
              title: "Developer Friendly",
              description: "Intuitive interface designed by developers for developers. No steep learning curve.",
              icon: Code,
            },
            {
              title: "Scalable Infrastructure",
              description: "Grow your projects without limits. Our infrastructure scales with your needs.",
              icon: Cloud,
            },
            {
              title: "Advanced Branching",
              description: "Powerful branching strategies for complex workflows. Merge with confidence.",
              icon: GitMerge,
            },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              className={`p-8 rounded-xl border transition-all ${
                isDark
                  ? "border-white/20 bg-white/10 hover:bg-white/20"
                  : "border-[#2d3e2d]/30 bg-white/40 hover:bg-white/60"
              }`}
              variants={itemVariants}
              whileHover={{ y: -5 }}
            >
              <feature.icon className={`w-12 h-12 mb-4 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>{feature.title}</h3>
              <p className={isDark ? "text-white/70" : "text-[#2d3e2d]"}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 4: Supported Technologies */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div className="text-center mb-16" variants={itemVariants}>
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
            isDark ? "text-white" : "text-[#2d3e2d]"
          }`}>
            Works With Your Stack
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${
            isDark ? "text-gray-300" : "text-[#4a5f4a]"
          }`}>
            Compatible with all major programming languages and frameworks
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {[
            { 
              name: "React", 
              icon: Code2,
              code: "const App = () => {\n  return (\n    <div>Hello</div>\n  );\n};",
              color: "from-blue-400 to-blue-600",
              description: "Leading UI library for building interactive web applications. Component-based architecture for scalable projects."
            },
            { 
              name: "Next.js", 
              icon: Code2,
              code: "export default function Page() {\n  return (\n    <h1>Welcome</h1>\n  );\n}",
              color: "from-gray-600 to-gray-800",
              description: "Full-stack React framework with server-side rendering. Build production-ready applications with ease."
            },
            { 
              name: "PHP", 
              icon: Code2,
              code: "<?php\necho 'Hello World';\n$name = 'Gent';\necho $name;\n?>",
              color: "from-purple-400 to-purple-600",
              description: "Server-side language powering millions of websites. Laravel and Symfony for modern web development."
            },
            { 
              name: "Python", 
              icon: Code2,
              code: "def hello():\n    print('Hello')\n    name = 'Gent'\n    return name",
              color: "from-yellow-400 to-blue-600",
              description: "Versatile language for web, data science, and AI. Django and Flask frameworks for rapid development."
            },
            { 
              name: "Java", 
              icon: Code2,
              code: "public class App {\n  public static void main() {\n    System.out.println();\n  }\n}",
              color: "from-orange-400 to-red-600",
              description: "Enterprise-grade language with Spring framework. Reliable for large-scale applications and microservices."
            },
            { 
              name: "Go", 
              icon: Code2,
              code: "package main\nimport \"fmt\"\nfunc main() {\n  fmt.Println(\"Hello\")\n}",
              color: "from-cyan-400 to-blue-600",
              description: "Modern language designed for concurrency and performance. Ideal for cloud-native and microservices architecture."
            },
            { 
              name: "TypeScript", 
              icon: Code2,
              code: "interface User {\n  name: string;\n  age: number;\n}",
              color: "from-blue-500 to-blue-700",
              description: "Superset of JavaScript with static typing. Ensures code quality and catches errors before runtime."
            },
            { 
              name: "Rust", 
              icon: Code2,
              code: "fn main() {\n    println!(\"Hello\");\n    let name = \"Gent\";\n}",
              color: "from-orange-600 to-red-700",
              description: "Systems programming language with memory safety. Perfect for performance-critical applications."
            },
            { 
              name: "C++", 
              icon: Code2,
              code: "#include <iostream>\nint main() {\n  std::cout << \"Hello\";\n}",
              color: "from-blue-600 to-cyan-500",
              description: "High-performance language for system software and game development. Unmatched speed and control."
            },
            { 
              name: "C#", 
              icon: Code2,
              code: "class Program {\n  static void Main() {\n    Console.WriteLine(\"Hello\");\n  }\n}",
              color: "from-purple-600 to-pink-500",
              description: "Modern language for .NET ecosystem. Build Windows apps, games, and cloud services with Azure."
            },
            { 
              name: "Vue.js", 
              icon: Code2,
              code: "<template>\n  <div>{{ message }}</div>\n</template>",
              color: "from-green-400 to-emerald-600",
              description: "Progressive JavaScript framework for building user interfaces. Gentle learning curve with powerful features."
            },
            { 
              name: "Angular", 
              icon: Code2,
              code: "@Component({\n  selector: 'app-root',\n  template: '<h1>Hello</h1>'\n})",
              color: "from-red-600 to-pink-500",
              description: "Full-featured framework for building dynamic web applications. Enterprise-ready with comprehensive tooling."
            },
            { 
              name: "Node.js", 
              icon: Code2,
              code: "const http = require('http');\nconst server = http.createServer();",
              color: "from-green-600 to-emerald-700",
              description: "JavaScript runtime for server-side development. Build scalable network applications with non-blocking I/O."
            },
            { 
              name: "Docker", 
              icon: Code2,
              code: "FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install",
              color: "from-blue-500 to-cyan-600",
              description: "Containerization platform for consistent deployments. Simplify development and production environments."
            },
            { 
              name: "Kubernetes", 
              icon: Code2,
              code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: gent-pod",
              color: "from-blue-600 to-cyan-700",
              description: "Container orchestration platform for scaling applications. Manage and deploy containerized workloads effortlessly."
            },
            { 
              name: "JavaScript", 
              icon: Code2,
              code: "const app = () => {\n  return <div>Hello</div>;\n};",
              color: "from-yellow-400 to-yellow-600",
              description: "The most popular language for web development. Perfect for full-stack applications with Node.js and modern frameworks."
            },
          ].map((tech, idx) => (
            <motion.div
              key={idx}
              className={`rounded-xl border transition-all overflow-hidden ${
                isDark
                  ? "border-white/20 bg-white/10 hover:bg-white/20"
                  : "border-[#2d3e2d]/30 bg-white/40 hover:bg-white/60"
              }`}
              variants={itemVariants}
              whileHover={{ y: -5 }}
            >
              <div className="relative">
                {/* Editor Header */}
                <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                  isDark
                    ? "border-white/10 bg-[#0f1419]/50"
                    : "border-[#2d3e2d]/20 bg-[#2d3e2d]/10"
                }`}>
                  <div className={`bg-gradient-to-br ${tech.color} w-5 h-5 rounded flex items-center justify-center`}>
                    <tech.icon className="w-3 h-3 text-white" />
                  </div>
                  <span className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-[#2d3e2d]"}`}>
                    {tech.name}
                  </span>
                </div>

                {/* Description under name */}
                <div className={`px-4 py-2 border-b ${
                  isDark
                    ? "border-white/10 bg-[#0f1419]/20"
                    : "border-[#2d3e2d]/20 bg-[#2d3e2d]/5"
                }`}>
                  <p className={`text-xs ${isDark ? "text-white/70" : "text-[#2d3e2d]/70"}`}>
                    {tech.description}
                  </p>
                </div>

                {/* Code Display */}
                <div className={`p-4 font-mono text-xs leading-relaxed overflow-hidden h-32 ${
                  isDark
                    ? "bg-[#0f1419]/30 text-green-400"
                    : "bg-[#1a1a1a] text-green-300"
                }`}>
                  {tech.code.split('\n').map((line, lineIdx) => (
                    <div key={lineIdx} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 5: CTA */}
      <motion.section 
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div 
          className={`rounded-2xl p-12 border text-center ${
            isDark
              ? "bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-md border-white/30"
              : "bg-gradient-to-r from-[#2d3e2d]/20 to-[#2d3e2d]/10 backdrop-blur-md border-[#2d3e2d]/30"
          }`}
          variants={itemVariants}
        >
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
            isDark ? "text-white" : "text-[#2d3e2d]"
          }`}>
            Start Your Career with Gent
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto ${
            isDark ? "text-white/80" : "text-[#2d3e2d]"
          }`}>
            Use Gent to create repositories, manage branches and members, and
            sync local work through the Gent CLI and API.
          </p>
          <motion.a
            href={AUTH_PATH.LOGIN}
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-lg transition-all font-bold ${
              isDark
                ? "bg-white text-[#0f1419] hover:shadow-xl hover:shadow-white/50"
                : "bg-[#2d3e2d] text-white hover:shadow-xl"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In Now <ArrowRight className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </motion.section>

      {/* Notification Card */}
      <NotificationCard />

      {/* Footer */}
      <SharedFooter />
        </>
      )}
    </div>
  );
}
