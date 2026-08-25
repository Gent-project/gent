"use client";

import { ChevronDown, HelpCircle, MessageSquare, Zap, Shield, Users, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import SharedFooter from "@/app/components/SharedFooter";
import NotificationCard from "@/app/components/NotificationCard";
import { useState, useEffect } from "react";

const faqCategories = [
  {
    category: "Getting Started",
    icon: Zap,
    questions: [
      {
        q: "What is Gent?",
        a: "Gent is a lightweight version control platform with its own CLI, REST API, and web dashboard. It manages repositories, commits, branches, tags, and collaborators through Gent commands and Gent API paths.",
      },
      {
        q: "How do I create an account?",
        a: "Simply visit our sign-up page, enter your email address, create a password, and verify your email. You'll have access to all starter features immediately. No credit card required.",
      },
      {
        q: "Is Gent free?",
        a: "Gent currently uses the project backend and CLI. Repository access depends on your account and repository permissions.",
      },
      {
        q: "Can I import existing repositories?",
        a: "Yes. Create a Gent repository, add the Gent API remote shown on the repository page, then push your local files with the Gent CLI.",
      },
    ],
  },
  {
    category: "Features & Functionality",
    icon: HelpCircle,
    questions: [
      {
        q: "What programming languages does Gent support?",
        a: "Gent works with all programming languages including JavaScript, Python, Java, PHP, Go, Rust, C++, and many more. Our version control system is language-agnostic.",
      },
      {
        q: "How do pull requests work?",
        a: "Gent currently focuses on repository access, branches, commits, tags, and push/pull synchronization. Review workflows can be handled through branch history and repository member roles.",
      },
      {
        q: "Can I use Gent with CI/CD pipelines?",
        a: "Use the Gent CLI in automation by authenticating once, setting the Gent API remote, then running Gent commands such as add, commit, push, pull, and clone.",
      },
      {
        q: "Does Gent support branching strategies?",
        a: "Gent supports named branches in the backend and dashboard. The Code tab reads the tree from the selected branch, and pushes update that branch only.",
      },
    ],
  },
  {
    category: "Security & Privacy",
    icon: Shield,
    questions: [
      {
        q: "How secure is my code?",
        a: "Repository access is controlled by authentication and repository membership. Private repositories are only available to the owner and allowed members.",
      },
      {
        q: "Can I make repositories private?",
        a: "Yes! All repositories can be set to private, public, or internal. You have full control over who can access your code through role-based access control.",
      },
      {
        q: "What about data backups?",
        a: "You can export repository history and files at any time with gent clone using the API path shown on the repository page.",
      },
      {
        q: "Does Gent comply with GDPR?",
        a: "Gent stores account and repository data needed to provide the platform. Contact the project team for account or data removal requests.",
      },
    ],
  },
  {
    category: "Collaboration & Teams",
    icon: Users,
    questions: [
      {
        q: "How do I invite team members?",
        a: "Open repository settings, add a member by account email, and choose their access role.",
      },
      {
        q: "What are the different user roles?",
        a: "Gent supports repository owner access plus member roles such as read, write, and admin depending on the backend permission for that repository.",
      },
      {
        q: "Can I manage repository access?",
        a: "Yes. Repository settings let the owner add members by email and choose the role supported by the backend for that repository.",
      },
      {
        q: "How do I review changes?",
        a: "Open the repository commits tab to inspect commit history and diffs. Branches can be used to separate work before pushing changes.",
      },
    ],
  },
  {
    category: "CLI & API",
    icon: MessageSquare,
    questions: [
      {
        q: "Which clone URL should I use?",
        a: "Use the API path shown on the repository page: https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>. The Gent CLI reads the owner id and repository name from that path.",
      },
      {
        q: "How do I connect a local repository?",
        a: "Run gent remote add origin with the repository API URL, then use gent add, gent commit, gent push, gent pull, and gent clone.",
      },
      {
        q: "Does the dashboard use the same backend as the CLI?",
        a: "Yes. The dashboard calls the same Gent API endpoints for repositories, branches, commits, trees, blobs, tags, members, push, pull, and clone.",
      },
      {
        q: "Can the web UI create the first file?",
        a: "Yes. Empty repositories can create a first text file through the Code tab, and the generated objects are compatible with Gent CLI clone and pull.",
      },
    ],
  },
];

export default function FAQ() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(faqCategories);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    
    if (!query) {
      setFilteredCategories(faqCategories);
      return;
    }

    const filtered = faqCategories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (item) =>
            item.q.toLowerCase().includes(query) ||
            item.a.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.questions.length > 0);
    
    setFilteredCategories(filtered);
  }, [searchQuery]);

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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]" 
        : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
    } text-foreground overflow-hidden pb-1`}>
      {!isHydrated ? null : (
        <>
          <SharedNavigation />

      {/* Hero Section */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-20 mt-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="text-center space-y-2" variants={itemVariants}>
          <h1 className={`text-5xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-lg ${
            isDark ? "text-white" : "text-[#1a2e1a]"
          }`}>
            Frequently Asked
            <span className={isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}> Questions</span>
          </h1>
          <p className={`text-lg leading-relaxed max-w-2xl mx-auto ${
            isDark ? "text-gray-300" : "text-[#2d3e2d]"
          }`}>
            Find answers to common questions about Gent. Search below or browse by category.
          </p>
          
          {/* Search Bar */}
          <motion.div 
            className="max-w-2xl mx-auto mt-8 relative"
            variants={itemVariants}
          >
            <div className={`relative rounded-xl border transition-all overflow-hidden ${
              isDark
                ? "border-white/20 bg-white/10 backdrop-blur-sm focus-within:bg-white/20 focus-within:border-white/40"
                : "border-[#5A7863]/30 bg-white/40 backdrop-blur-sm focus-within:bg-white/60 focus-within:border-[#5A7863]/60"
            }`}>
              <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                isDark ? "text-white/60" : "text-[#2d3e2d]/60"
              }`} />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none text-lg ${
                  isDark ? "text-white placeholder-white/50" : "text-[#2d3e2d] placeholder-[#2d3e2d]/50"
                }`}
              />
            </div>
            {searchQuery && (
              <p className={`text-sm mt-2 ${isDark ? "text-white/60" : "text-[#2d3e2d]/60"}`}>
                Found {filteredCategories.reduce((acc, cat) => acc + cat.questions.length, 0)} result(s)
              </p>
            )}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* FAQ Categories */}
      <motion.section 
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category, catIdx) => (
            <motion.div key={catIdx} className="mb-16" variants={itemVariants}>
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-8">
                <category.icon className={`w-8 h-8 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                <h2 className={`text-3xl font-bold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>
                  {category.category}
                </h2>
              </div>

              {/* FAQ Items */}
              <div className="space-y-4">
                {category.questions.map((item, qIdx) => {
                  const itemId = `${catIdx}-${qIdx}`;
                  const isExpanded = expandedIndex === itemId;

                  return (
                    <motion.div
                      key={qIdx}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isDark
                          ? "border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                          : "border-[#5A7863]/30 bg-white/40 backdrop-blur-sm hover:bg-white/60"
                      }`}
                      variants={itemVariants}
                      whileHover={{ y: -2 }}
                    >
                      <motion.button
                        onClick={() => setExpandedIndex(isExpanded ? null : itemId)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left"
                        whileHover={{ x: 5 }}
                      >
                        <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>
                          {item.q}
                        </h3>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
                        </motion.div>
                      </motion.button>

                      {/* Answer */}
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                          height: isExpanded ? "auto" : 0,
                          opacity: isExpanded ? 1 : 0,
                        }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className={`px-6 pb-4 border-t ${
                          isDark
                            ? "border-white/10 text-white/80"
                            : "border-[#2d3e2d]/20 text-[#2d3e2d]"
                        }`}>
                          {item.a}
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            className="text-center py-12"
            variants={itemVariants}
          >
            <p className={`text-lg ${isDark ? "text-white/60" : "text-[#2d3e2d]/60"}`}>
              No questions found matching "{searchQuery}". Try a different search term.
            </p>
          </motion.div>
        )}
      </motion.section>

      {/* CTA Section */}
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
            Still Have Questions?
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto ${
            isDark ? "text-white/80" : "text-[#2d3e2d]"
          }`}>
            Our support team is here to help. Reach out to us via email, chat, or schedule a demo with our team.
          </p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={itemVariants}
          >
            <motion.a
              href="mailto:info@Gent.com"
              className={`px-8 py-4 rounded-lg transition-all font-bold text-center flex items-center justify-center gap-2 ${
                isDark
                  ? "bg-white text-[#0f1419] hover:shadow-xl hover:shadow-white/50"
                  : "bg-[#2d3e2d] text-white hover:shadow-xl"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Contact Support
            </motion.a>
            <motion.a
              href="mailto:info@Gent.com"
              className={`px-8 py-4 rounded-lg border-2 transition-all font-bold flex items-center justify-center gap-2 ${
                isDark
                  ? "border-white text-white hover:bg-white/10"
                  : "border-[#2d3e2d] text-[#2d3e2d] hover:bg-[#2d3e2d]/10"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageSquare className="w-5 h-5" /> Email Us
            </motion.a>
          </motion.div>
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
