"use client";

import {
  ButtonHTMLAttributes,
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Language = "en" | "ar";

const LANGUAGE_KEY = "gent-language";

const translations: Record<string, string> = {
  Home: "الرئيسية",
  "CLI Docs": "توثيق CLI",
  FAQ: "الأسئلة الشائعة",
  Privacy: "الخصوصية",
  Terms: "الشروط",
  Dashboard: "لوحة التحكم",
  Settings: "الإعدادات",
  "Sign in": "تسجيل الدخول",
  "Sign In": "تسجيل الدخول",
  "Sign up": "إنشاء حساب",
  "Create Account": "إنشاء حساب",
  "Creating Account...": "جار إنشاء الحساب...",
  "Forgot password?": "نسيت كلمة المرور؟",
  Email: "البريد الإلكتروني",
  Password: "كلمة المرور",
  "Confirm Password": "تأكيد كلمة المرور",
  "First Name": "الاسم الأول",
  "Last Name": "اسم العائلة",
  "New repository": "مستودع جديد",
  "New Repository": "مستودع جديد",
  New: "جديد",
  Retry: "إعادة المحاولة",
  Total: "الإجمالي",
  Public: "عام",
  Private: "خاص",
  "Updated Today": "حُدث اليوم",
  "Your Repositories": "مستودعاتك",
  "Your repositories": "مستودعاتك",
  "Repository workspace": "مساحة عمل المستودعات",
  "repository workspace": "مساحة المستودعات",
  "live branch topology": "مخطط الفروع المباشر",
  "main synced": "الفرع الرئيسي متزامن",
  "Genti is shipping it.": "جينتي يدفع تغييراتك.",
  "Genti on watch": "جينتي يراقب",
  "Interactive CLI guide": "دليل CLI تفاعلي",
  "Repository CLI guide": "دليل CLI للمستودع",
  "Ask Genti how it works": "اسأل جينتي كيف تعمل الأوامر",
  "CLI coach": "مرشد CLI",
  "Gent workflows": "عمليات Gent",
  Init: "البدء",
  Merge: "دمج",
  "First push": "الدفع الأول",
  "Ready for updates": "جاهز للتحديثات",
  "Empty repository": "مستودع فارغ",
  "Ship your next update": "انشر تحديثك التالي",
  "Sync first, record your changes, then publish them safely.":
    "زامن أولاً، ثم سجل تغييراتك وانشرها بأمان.",
  "Publish this repository": "انشر هذا المستودع",
  "Genti will initialize your folder and send its first commit here.":
    "سيهيئ جينتي مجلدك ويرسل أول التزام إلى هنا.",
  "Publish local commits": "انشر الالتزامات المحلية",
  "Check your working tree, then upload the current branch.":
    "تحقق من شجرة العمل، ثم ارفع الفرع الحالي.",
  "Genti will guide your first push from the repository panel.":
    "سيرشدك جينتي خلال أول عملية دفع من لوحة المستودع.",
  "Start a local repository": "ابدأ مستودعاً محلياً",
  "Initialize Gent, stage your project, and record the first commit.":
    "هيئ Gent، وجهز مشروعك، وسجل الالتزام الأول.",
  "Publish your commits": "انشر التزاماتك",
  "Connect this folder to a dashboard repository, then upload main.":
    "اربط هذا المجلد بمستودع لوحة التحكم، ثم ارفع الفرع الرئيسي.",
  "Bring remote changes home": "اجلب التغييرات البعيدة",
  "Download the latest remote commits and merge them locally.":
    "نزّل أحدث الالتزامات البعيدة وادمجها محلياً.",
  "Combine two branches": "ادمج فرعين",
  "Merge a feature into your current branch, then publish the result.":
    "ادمج فرع الميزة في فرعك الحالي، ثم انشر النتيجة.",
  Copied: "تم النسخ",
  "Repository index": "فهرس المستودعات",
  "Browse code, follow branch activity, and manage every project from one workspace.":
    "تصفح الكود، وتابع نشاط الفروع، وأدر كل مشروع من مساحة عمل واحدة.",
  Projects: "المشاريع",
  "No description provided.": "لم تتم إضافة وصف.",
  "No description provided for this repository.": "لم تتم إضافة وصف لهذا المستودع.",
  About: "حول المستودع",
  Created: "تاريخ الإنشاء",
  "Repository ID": "معرف المستودع",
  "Clone repository": "استنساخ المستودع",
  "Clone & Git operations": "الاستنساخ وعمليات Git",
  "Repository tree": "شجرة المستودع",
  Name: "الاسم",
  Object: "الكائن",
  Type: "النوع",
  Directory: "مجلد",
  all: "الكل",
  public: "عام",
  private: "خاص",
  newest: "الأحدث",
  oldest: "الأقدم",
  name: "الاسم",
  "Find a repository...": "ابحث عن مستودع...",
  "Find a repository…": "ابحث عن مستودع...",
  "Toggle theme": "تبديل السمة",
  "Open sidebar": "فتح الشريط الجانبي",
  "Open menu": "فتح القائمة",
  "Light Mode": "الوضع الفاتح",
  "Dark Mode": "الوضع الداكن",
  Logout: "تسجيل الخروج",
  User: "المستخدم",
  "Failed to load repositories. Please try again.": "تعذر تحميل المستودعات. حاول مرة أخرى.",
  "Loading your repositories...": "جار تحميل مستودعاتك...",
  Repositories: "المستودعات",
  Branches: "الفروع",
  Commits: "الالتزامات",
  Tags: "الوسوم",
  Code: "الملفات",
  Files: "الملفات",
  Members: "الأعضاء",
  "Create file": "إنشاء ملف",
  "Create new file": "إنشاء ملف جديد",
  "Upload files": "رفع الملفات",
  "Upload file": "رفع ملف",
  "File name": "اسم الملف",
  "File content": "محتوى الملف",
  "Commit message": "رسالة الالتزام",
  "Author name": "اسم المؤلف",
  "Your name": "اسمك",
  "Add new file": "إضافة ملف جديد",
  "Enter file content...": "اكتب محتوى الملف...",
  "Write your file content here...": "اكتب محتوى الملف هنا...",
  "Initial commit": "الالتزام الأول",
  "Create Initial Commit": "إنشاء الالتزام الأول",
  "Creating...": "جار الإنشاء...",
  "Uploading...": "جار الرفع...",
  "Success!": "تم بنجاح!",
  "File created successfully!": "تم إنشاء الملف بنجاح!",
  "Files uploaded successfully!": "تم رفع الملفات بنجاح!",
  "This repository is empty": "هذا المستودع فارغ",
  "Create the first file here, upload files, or use the Gent CLI to push an existing project.":
    "أنشئ أول ملف هنا، أو ارفع ملفات، أو استخدم Gent CLI لدفع مشروع موجود.",
  "Quick start with Gent CLI:": "بداية سريعة باستخدام Gent CLI:",
  "Copy commands": "نسخ الأوامر",
  "Back to files": "العودة إلى الملفات",
  Back: "رجوع",
  "Download file": "تنزيل الملف",
  "Copy content": "نسخ المحتوى",
  "Edit file": "تعديل الملف",
  Cancel: "إلغاء",
  "Save changes": "حفظ التغييرات",
  "Saving...": "جار الحفظ...",
  "Unable to load file content": "تعذر تحميل محتوى الملف",
  "Unable to copy file content.": "تعذر نسخ محتوى الملف.",
  "Unable to save the updated file.": "تعذر حفظ الملف المحدث.",
  "Please select files to upload": "اختر ملفات لرفعها",
  "File name is required": "اسم الملف مطلوب",
  "File content cannot be empty": "لا يمكن أن يكون محتوى الملف فارغاً",
  "Commit message is required": "رسالة الالتزام مطلوبة",
  "Author name is required": "اسم المؤلف مطلوب",
  "Failed to create file": "فشل إنشاء الملف",
  "Failed to upload files": "فشل رفع الملفات",
  "Clone": "استنساخ",
  "Push": "دفع",
  "Pull": "سحب",
  "Pull Repository": "سحب المستودع",
  "Pulling...": "جار السحب...",
  "Use Gent CLI commands:": "استخدم أوامر Gent CLI:",
  "Clone with Gent CLI": "استنساخ باستخدام Gent CLI",
  "Uses the repository owner id and name": "يستخدم معرف مالك المستودع واسمه",
  "Repository Management": "إدارة المستودعات",
  "Team Collaboration": "تعاون الفريق",
  "Pull Requests": "طلبات السحب",
  "Security & Access": "الأمان والصلاحيات",
  "Lightning Fast": "سريع جداً",
  "CI/CD Integration": "تكامل CI/CD",
  "Quick Start": "بداية سريعة",
  "Create your account": "أنشئ حسابك",
  "Initialize repository": "ابدأ المستودع",
  "Start collaborating": "ابدأ التعاون",
  "Deploy with confidence": "انشر بثقة",
  "Open Dashboard": "فتح لوحة التحكم",
  "Read CLI Docs": "قراءة توثيق CLI",
  "Gent version control": "نظام Gent للتحكم بالإصدارات",
  "A simple web home for the Gent CLI.": "واجهة ويب بسيطة لأداة Gent CLI.",
  "Gent connects a lightweight CLI, a hosted API, and a dashboard for repositories, commits, branches, tags, files, and members.":
    "يربط Gent بين CLI خفيف وAPI مستضاف ولوحة تحكم للمستودعات والالتزامات والفروع والوسوم والملفات والأعضاء.",
  "Gent terminal": "طرفية Gent",
  "API remote format": "صيغة رابط API البعيد",
  "Object storage": "تخزين الكائنات",
  "Dashboard routes": "مسارات لوحة التحكم",
  "Blob SHA-256 with Gent push packs": "كائنات Blob باستخدام SHA-256 مع حزم دفع Gent",
  "What exists now": "ما هو متوفر الآن",
  "Built around real Gent workflows.": "مبني حول سير عمل Gent الحقيقي.",
  "These are the parts connected to the current CLI, API, and dashboard flow.":
    "هذه هي الأجزاء المتصلة حالياً بسير عمل CLI وAPI ولوحة التحكم.",
  "Gent CLI": "أداة Gent CLI",
  "Initialize local repositories, stage files, commit changes, push, pull, and clone from the Gent API.":
    "ابدأ المستودعات المحلية، جهز الملفات، سجل التغييرات، ادفع، اسحب، واستنسخ من Gent API.",
  "Code Browser": "متصفح الكود",
  "Open repository files from the dashboard, switch branches, read blobs, and create small text files.":
    "افتح ملفات المستودع من لوحة التحكم، بدّل الفروع، اقرأ كائنات Blob، وأنشئ ملفات نصية صغيرة.",
  "Create branches from existing commits and keep each branch tree separate in the Code tab.":
    "أنشئ فروعاً من الالتزامات الموجودة واحتفظ بشجرة كل فرع منفصلة في تبويب الملفات.",
  "Commit History": "سجل الالتزامات",
  "Review commit lists and diffs from the same backend data used by the CLI.":
    "راجع قوائم الالتزامات والفروقات من بيانات الخادم نفسها التي يستخدمها CLI.",
  "Push and Pull": "الدفع والسحب",
  "Use Gent push packs and pull endpoints to sync local objects with the hosted repository.":
    "استخدم حزم دفع Gent ونقاط السحب لمزامنة الكائنات المحلية مع المستودع المستضاف.",
  "Repository Access": "الوصول إلى المستودع",
  "Private repositories and member roles are handled by the Gent backend permissions.":
    "تتم إدارة المستودعات الخاصة وأدوار الأعضاء عبر صلاحيات خادم Gent.",
  "From CLI to backend": "من CLI إلى الخادم",
  "The CLI stores local objects, sends push packs to the API, and clones repositories from the owner-id URL shown in the dashboard.":
    "يخزن CLI الكائنات محلياً، ويرسل حزم الدفع إلى API، ويستنسخ المستودعات من رابط معرف المالك الظاهر في لوحة التحكم.",
  "From backend to web": "من الخادم إلى الويب",
  "The dashboard reads repositories, branches, commits, trees, blobs, tags, and members directly from Gent API endpoints.":
    "تقرأ لوحة التحكم المستودعات والفروع والالتزامات والأشجار وكائنات Blob والوسوم والأعضاء مباشرة من نقاط Gent API.",
  "Lightweight version control for this project.": "تحكم خفيف بالإصدارات لهذا المشروع.",
  "Gent dashboard uses the same API repository path expected by the CLI:":
    "تستخدم لوحة تحكم Gent مسار مستودع API نفسه الذي يتوقعه CLI:",
  "CLI + API + Web": "سطر الأوامر + الواجهة البرمجية + الويب",
  "Search Gent questions": "ابحث في أسئلة Gent",
  "No FAQ entries match this search.": "لا توجد نتائج مطابقة لهذا البحث.",
  "What is Gent?": "ما هو Gent؟",
  "Is Gent the same as GitHub?": "هل Gent مثل GitHub؟",
  "What does the website do?": "ماذا يفعل الموقع؟",
  "How do I install the CLI?": "كيف أثبت CLI؟",
  "Can I create an empty repository?": "هل يمكنني إنشاء مستودع فارغ؟",
  "Can I delete a repository?": "هل يمكنني حذف مستودع؟",
  "Account": "الحساب",
  "Profile": "الملف الشخصي",
  "Change Password": "تغيير كلمة المرور",
  "Changing Password...": "جار تغيير كلمة المرور...",
  "Password changed successfully": "تم تغيير كلمة المرور بنجاح",
  "Failed to change password": "فشل تغيير كلمة المرور",
  "Enter your current password": "أدخل كلمة المرور الحالية",
  "Enter your new password": "أدخل كلمة المرور الجديدة",
  "Confirm your new password": "أكد كلمة المرور الجديدة",
  "Profile updated successfully.": "تم تحديث الملف الشخصي بنجاح.",
  "Failed to update profile": "فشل تحديث الملف الشخصي",
  "Could not load profile.": "تعذر تحميل الملف الشخصي.",
  "First name": "الاسم الأول",
  "Last name": "اسم العائلة",
  "General": "عام",
  "Navigation": "التنقل",
  "Repository": "المستودع",
  "Create new repository": "إنشاء مستودع جديد",
  "Refresh repositories": "تحديث المستودعات",
  "Toggle dark/light theme": "تبديل الوضع الداكن/الفاتح",
  "Focus search bar": "التركيز على شريط البحث",
  "Go to Dashboard": "الذهاب إلى لوحة التحكم",
  "Go to Settings": "الذهاب إلى الإعدادات",
  "Close modal/dialog": "إغلاق النافذة",
  "Navigate between elements": "التنقل بين العناصر",
  "Open selected repository": "فتح المستودع المحدد",
  "Open repository in new tab": "فتح المستودع في تبويب جديد",
  "Delete repository (with confirmation)": "حذف المستودع بعد التأكيد",
  "Edit repository settings": "تعديل إعدادات المستودع",
  "Tag name is required": "اسم الوسم مطلوب",
  "Tag name cannot contain spaces": "اسم الوسم لا يمكن أن يحتوي على مسافات",
  "Tag name is too long": "اسم الوسم طويل جداً",
  "Create tag": "إنشاء وسم",
  "Release notes or tag message...": "ملاحظات الإصدار أو رسالة الوسم...",
  "Source branch not found": "لم يتم العثور على فرع المصدر",
  "Message is required for annotated tags": "الرسالة مطلوبة للوسوم المشروحة",
  "Failed to create tag": "فشل إنشاء الوسم",
  "Delete branch": "حذف الفرع",
  "Deleting...": "جار الحذف...",
  "Failed to load commit.": "تعذر تحميل الالتزام.",
  "Show password": "إظهار كلمة المرور",
  "Hide password": "إخفاء كلمة المرور",
  "Hide current password": "إخفاء كلمة المرور الحالية",
  "Show current password": "إظهار كلمة المرور الحالية",
  "Hide new password": "إخفاء كلمة المرور الجديدة",
  "Show new password": "إظهار كلمة المرور الجديدة",
  "Hide password confirmation": "إخفاء تأكيد كلمة المرور",
  "Show password confirmation": "إظهار تأكيد كلمة المرور",
  "Change language": "تغيير اللغة",
  "CLI documentation": "توثيق CLI",
  "Gent commands, grouped by workflow.": "أوامر Gent مرتبة حسب سير العمل.",
  "This page summarizes the checked-in Gent CLI command reference and keeps the web instructions aligned with the backend API contract.":
    "تلخص هذه الصفحة مرجع أوامر Gent CLI الموجود في المشروع وتحافظ على توافق تعليمات الويب مع عقد API في الخادم.",
  "Remote URL format": "صيغة رابط المستودع البعيد",
  "Quick start": "بداية سريعة",
  "Command Reference": "مرجع الأوامر",
  "Repository Setup": "إعداد المستودع",
  "Staging and Working Tree": "منطقة التجهيز وشجرة العمل",
  History: "السجل",
  "Branches and Merges": "الفروع والدمج",
  "Remote Sync": "المزامنة البعيدة",
  Safety: "السلامة",
  Inspection: "الفحص",
  "Guided interactive flow for auth, init, remote, commit, and push.":
    "سير تفاعلي موجه للمصادقة والتهيئة والربط البعيد والالتزام والدفع.",
  "Create a local .gent repository.": "إنشاء مستودع .gent محلي.",
  "Download a full repository from the Gent backend.": "تنزيل مستودع كامل من خادم Gent.",
  "Show staged, modified, untracked, and deleted files.":
    "عرض الملفات المجهزة والمعدلة وغير المتتبعة والمحذوفة.",
  "Snapshot files and stage them.": "أخذ لقطة للملفات وتجهيزها.",
  "Stop tracking files.": "إيقاف تتبع الملفات.",
  "Unstage files.": "إزالة الملفات من التجهيز.",
  "Show line-level diffs.": "عرض الفروقات على مستوى الأسطر.",
  "Record staged changes.": "تسجيل التغييرات المجهزة.",
  "Inspect commit history.": "فحص سجل الالتزامات.",
  "Show commit details and diff.": "عرض تفاصيل الالتزام والفروقات.",
  "Create, list, or delete tags.": "إنشاء الوسوم أو عرضها أو حذفها.",
  "Summarize a commit or staged changes.": "تلخيص التزام أو تغييرات مجهزة.",
  "List, create, or delete branches.": "عرض الفروع أو إنشاؤها أو حذفها.",
  "Switch branches or create a new branch.": "تبديل الفروع أو إنشاء فرع جديد.",
  "Merge another branch into the current branch.": "دمج فرع آخر في الفرع الحالي.",
  "Resolve conflicts left by a merge.": "حل التعارضات الناتجة عن الدمج.",
  "Temporarily store working changes.": "حفظ تغييرات العمل مؤقتاً.",
  "Manage repository remotes.": "إدارة المستودعات البعيدة.",
  "List or create backend repositories.": "عرض مستودعات الخادم أو إنشاؤها.",
  "Upload commits and objects.": "رفع الالتزامات والكائنات.",
  "Download and merge remote commits.": "تنزيل ودمج الالتزامات البعيدة.",
  "Create a Gent account.": "إنشاء حساب Gent.",
  "Log in and store local CLI auth.": "تسجيل الدخول وحفظ مصادقة CLI محلياً.",
  "Clear local CLI auth.": "مسح مصادقة CLI المحلية.",
  "Show the current authenticated user.": "عرض المستخدم المصادق عليه حالياً.",
  "Reverse the last history-changing operation.": "عكس آخر عملية غيرت السجل.",
  "Show operation history.": "عرض سجل العمليات.",
  "Re-apply the last undone operation.": "إعادة تطبيق آخر عملية تم التراجع عنها.",
  "Move branch pointer without changing files.": "نقل مؤشر الفرع دون تغيير الملفات.",
  "Restore branch pointer and working tree.": "استعادة مؤشر الفرع وشجرة العمل.",
  "Show repository health and local stats.": "عرض صحة المستودع والإحصاءات المحلية.",
  "Draw an ASCII graph with branch and merge labels.": "رسم مخطط ASCII مع تسميات الفروع والدمج.",
  "Inspect the current or selected commit.": "فحص الالتزام الحالي أو المحدد.",
  "Gent FAQ": "أسئلة Gent الشائعة",
  "Answers for the current Gent website.": "إجابات لموقع Gent الحالي.",
  "Focused on what exists now: the CLI, backend API, dashboard, repositories, files, branches, members, and account flows.":
    "تركز على الموجود حالياً: CLI وAPI ولوحة التحكم والمستودعات والملفات والفروع والأعضاء وسير الحساب.",
  "Gent Basics": "أساسيات Gent",
  "Files and Branches": "الملفات والفروع",
  Access: "الوصول",
  "Gent is this project's lightweight version control system. It has a CLI, a Django API, and a web dashboard for repositories, branches, commits, tags, files, and repository access.":
    "Gent هو نظام التحكم بالإصدارات الخفيف لهذا المشروع. يحتوي على CLI وDjango API ولوحة ويب للمستودعات والفروع والالتزامات والوسوم والملفات والوصول.",
  "No. Gent uses its own CLI commands and backend API paths. The website should show Gent workflows, not GitHub instructions.":
    "لا. يستخدم Gent أوامر CLI ومسارات API خاصة به. يجب أن يعرض الموقع سير عمل Gent وليس تعليمات GitHub.",
  "The website lets authenticated users create repositories, browse repository files, switch branches, inspect commits, manage tags, copy CLI remotes, and open repository settings.":
    "يتيح الموقع للمستخدمين المصادق عليهم إنشاء المستودعات، تصفح الملفات، تبديل الفروع، فحص الالتزامات، إدارة الوسوم، نسخ روابط CLI، وفتح إعدادات المستودع.",
  "Install the package with npm install -g gent-cli, then sign in with gent login.":
    "ثبت الحزمة باستخدام npm install -g gent-cli ثم سجل الدخول عبر gent login.",
  "How do I connect a local folder to a repository?": "كيف أربط مجلداً محلياً بمستودع؟",
  "Run gent init, add and commit your files, then set the remote with gent remote add origin using the API repository URL shown in the dashboard.":
    "شغل gent init، ثم أضف ملفاتك وسجلها، وبعدها اضبط الرابط البعيد باستخدام gent remote add origin مع رابط API الظاهر في لوحة التحكم.",
  "Which remote URL format works with the CLI?": "ما صيغة الرابط البعيد التي تعمل مع CLI؟",
  "Use https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>. The dashboard clone section uses this same structure.":
    "استخدم https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>. قسم الاستنساخ في لوحة التحكم يستخدم البنية نفسها.",
  "Where can I read the command list?": "أين أقرأ قائمة الأوامر؟",
  "Open the CLI Docs page from the top banner. It groups commands for setup, staging, history, branches, remotes, account, safety, and inspection.":
    "افتح صفحة توثيق CLI من الشريط العلوي. تجمع الأوامر للإعداد والتجهيز والسجل والفروع والروابط البعيدة والحساب والسلامة والفحص.",
  "Yes. New repositories start with the default branch. The Code tab can create the first text file and commit it without needing an upload first.":
    "نعم. تبدأ المستودعات الجديدة بالفرع الافتراضي. يمكن لتبويب الملفات إنشاء أول ملف نصي وتسجيله دون الحاجة إلى رفع ملف أولاً.",
  "What repository names are valid?": "ما أسماء المستودعات المقبولة؟",
  "Repository names can contain letters, numbers, dashes, and underscores. Dots and spaces are rejected by the backend.":
    "يمكن أن تحتوي أسماء المستودعات على حروف وأرقام وشرطات وشرطات سفلية. يرفض الخادم النقاط والمسافات.",
  "Repository owners can delete a repository from repository settings by typing the repository name to confirm the action.":
    "يمكن لمالكي المستودع حذفه من إعدادات المستودع بكتابة اسم المستودع لتأكيد العملية.",
  "Why does sorting matter?": "لماذا يهم الفرز؟",
  "The dashboard repository list can be sorted by newest, oldest, or name without changing the repositories stored in the backend.":
    "يمكن فرز قائمة مستودعات لوحة التحكم حسب الأحدث أو الأقدم أو الاسم دون تغيير المستودعات المخزنة في الخادم.",
  "Does the Code tab follow the selected branch?": "هل يتبع تبويب الملفات الفرع المحدد؟",
  "Yes. File browsing is tied to the selected branch commit and tree, so switching branches should show that branch's files only.":
    "نعم. تصفح الملفات مرتبط بالتزام وشجرة الفرع المحدد، لذلك يجب أن يعرض تبديل الفروع ملفات ذلك الفرع فقط.",
  "Does the code viewer support formatting?": "هل يدعم عارض الكود التنسيق؟",
  "The code viewer renders source in a monospace block with lightweight syntax highlighting for common code tokens.":
    "يعرض عارض الكود المصدر بخط ثابت مع تمييز خفيف للرموز الشائعة.",
  "Can I create branches from the website?": "هل يمكنني إنشاء فروع من الموقع؟",
  "Branches can be created after the repository has an initial commit. Empty repositories need a first file or upload first.":
    "يمكن إنشاء الفروع بعد أن يحتوي المستودع على التزام أول. تحتاج المستودعات الفارغة إلى ملف أول أو رفع أولاً.",
  "Who can see a private repository?": "من يمكنه رؤية مستودع خاص؟",
  "Private repositories are available to the owner and users granted access through the backend repository member system.":
    "المستودعات الخاصة متاحة للمالك وللمستخدمين الذين مُنحوا الوصول عبر نظام أعضاء المستودع في الخادم.",
  "Can repository access be managed in the dashboard?": "هل يمكن إدارة وصول المستودع من لوحة التحكم؟",
  "Yes. The backend exposes repository member endpoints. Repository owners can add registered users by email and remove existing members.":
    "نعم. يوفر الخادم نقاط نهاية لأعضاء المستودع. يستطيع المالكون إضافة مستخدمين مسجلين بالبريد الإلكتروني وإزالة الأعضاء الحاليين.",
  "Can I remove the owner from a repository?": "هل يمكنني إزالة المالك من المستودع؟",
  "No. The backend returns the owner as part of the access list, but the owner cannot be removed through the member endpoint.":
    "لا. يعيد الخادم المالك ضمن قائمة الوصول، لكن لا يمكن إزالة المالك عبر نقطة نهاية الأعضاء.",
  "How is the signed-in user shown?": "كيف يظهر المستخدم المسجل دخوله؟",
  "The dashboard reads the authenticated profile and displays the real name, username, or email prefix instead of a generic user label.":
    "تقرأ لوحة التحكم الملف الشخصي المصادق عليه وتعرض الاسم الحقيقي أو اسم المستخدم أو بادئة البريد بدلاً من تسمية عامة.",
  "What happens if my session expires?": "ماذا يحدث إذا انتهت الجلسة؟",
  "The frontend tries to refresh the access token. If refresh fails, local auth state is cleared and the app returns to sign in.":
    "تحاول الواجهة تحديث رمز الوصول. إذا فشل التحديث، يتم مسح حالة المصادقة المحلية ويعود التطبيق إلى تسجيل الدخول.",
  "Can I change my password?": "هل يمكنني تغيير كلمة المرور؟",
  "The account settings page calls the backend password-change endpoint and shows validation errors returned by the API.":
    "تستدعي صفحة إعدادات الحساب نقطة نهاية تغيير كلمة المرور في الخادم وتعرض أخطاء التحقق العائدة من API.",
  "Powerful Services for": "خدمات قوية لـ",
  "Your Projects": "مشاريعك",
  "Gent provides comprehensive version control and collaboration services designed to streamline your development workflow. From repository management to team collaboration, we've got everything you need.":
    "يوفر Gent خدمات شاملة للتحكم بالإصدارات والتعاون لتبسيط سير عمل التطوير، من إدارة المستودعات إلى تعاون الفريق.",
  "Start New Project": "بدء مشروع جديد",
  "Our Core Services": "خدماتنا الأساسية",
  "Comprehensive solutions for modern development teams": "حلول شاملة لفرق التطوير الحديثة",
  Core: "أساسي",
  Collaboration: "تعاون",
  Review: "مراجعة",
  Security: "أمان",
  Performance: "أداء",
  Integration: "تكامل",
  "Manage your code repositories with ease. Create, clone, and organize projects with our intuitive interface.":
    "أدر مستودعات الكود بسهولة. أنشئ واستنسخ ونظم المشاريع بواجهة واضحة.",
  "Work seamlessly with your team. Real-time updates, comments, and notifications keep everyone in sync.":
    "اعمل بسلاسة مع فريقك. تبقي التحديثات والتعليقات والإشعارات الجميع متزامنين.",
  "Review code changes before merging. Discuss improvements and maintain code quality standards.":
    "راجع تغييرات الكود قبل الدمج. ناقش التحسينات وحافظ على جودة الكود.",
  "Enterprise-grade security with role-based access control and encrypted repositories.":
    "أمان بمستوى مؤسسي مع تحكم وصول حسب الأدوار ومستودعات مشفرة.",
  "Optimized for speed. Clone, commit, and push operations complete in seconds.":
    "محسن للسرعة. تنتهي عمليات الاستنساخ والالتزام والدفع خلال ثوانٍ.",
  "Integrate with your favorite tools. Automate testing and deployment workflows.":
    "تكامل مع أدواتك المفضلة. أتمتة سير الاختبار والنشر.",
  "Why Developers Choose Gent": "لماذا يختار المطورون Gent",
  "Industry-leading features that make development easier": "ميزات متقدمة تجعل التطوير أسهل",
  "Lightweight & Efficient": "خفيف وفعال",
  "Minimal resource usage with maximum performance. Our optimized architecture ensures fast operations.":
    "استهلاك منخفض للموارد مع أداء عالٍ. تضمن البنية المحسنة عمليات سريعة.",
  "Developer Friendly": "مناسب للمطورين",
  "Intuitive interface designed by developers for developers. No steep learning curve.":
    "واجهة واضحة صممها مطورون للمطورين دون منحنى تعلم صعب.",
  "Scalable Infrastructure": "بنية قابلة للتوسع",
  "Grow your projects without limits. Our infrastructure scales with your needs.":
    "نمّ مشاريعك دون حدود. تتوسع بنيتنا حسب احتياجاتك.",
  "Advanced Branching": "تفريع متقدم",
  "Powerful branching strategies for complex workflows. Merge with confidence.":
    "استراتيجيات تفريع قوية لسير العمل المعقد. ادمج بثقة.",
  "Works With Your Stack": "يعمل مع تقنياتك",
  "Compatible with all major programming languages and frameworks":
    "متوافق مع أشهر لغات البرمجة وأطر العمل",
  "Leading UI library for building interactive web applications. Component-based architecture for scalable projects.":
    "مكتبة واجهات رائدة لبناء تطبيقات ويب تفاعلية مع بنية مكونات قابلة للتوسع.",
  "Full-stack React framework with server-side rendering. Build production-ready applications with ease.":
    "إطار React متكامل مع تصيير من جهة الخادم لبناء تطبيقات جاهزة للإنتاج بسهولة.",
  "Server-side language powering millions of websites. Laravel and Symfony for modern web development.":
    "لغة خادم تشغل ملايين المواقع مع Laravel وSymfony لتطوير ويب حديث.",
  "Versatile language for web, data science, and AI. Django and Flask frameworks for rapid development.":
    "لغة متعددة الاستخدامات للويب وعلوم البيانات والذكاء الاصطناعي مع Django وFlask للتطوير السريع.",
  "Enterprise-grade language with Spring framework. Reliable for large-scale applications and microservices.":
    "لغة بمستوى مؤسسي مع إطار Spring، موثوقة للتطبيقات الكبيرة والخدمات المصغرة.",
  "Modern language designed for concurrency and performance. Ideal for cloud-native and microservices architecture.":
    "لغة حديثة مصممة للتزامن والأداء، مناسبة للبنية السحابية والخدمات المصغرة.",
  "Superset of JavaScript with static typing. Ensures code quality and catches errors before runtime.":
    "امتداد لـ JavaScript مع أنواع ثابتة لتحسين جودة الكود واكتشاف الأخطاء قبل التشغيل.",
  "Systems programming language with memory safety. Perfect for performance-critical applications.":
    "لغة برمجة للأنظمة مع أمان للذاكرة، مناسبة للتطبيقات الحساسة للأداء.",
  "High-performance language for system software and game development. Unmatched speed and control.":
    "لغة عالية الأداء لبرمجيات الأنظمة وتطوير الألعاب مع سرعة وتحكم قويين.",
  "Modern language for .NET ecosystem. Build Windows apps, games, and cloud services with Azure.":
    "لغة حديثة لمنظومة .NET لبناء تطبيقات Windows والألعاب والخدمات السحابية مع Azure.",
  "Progressive JavaScript framework for building user interfaces. Gentle learning curve with powerful features.":
    "إطار JavaScript تدريجي لبناء واجهات المستخدم مع تعلم سهل وميزات قوية.",
  "Full-featured framework for building dynamic web applications. Enterprise-ready with comprehensive tooling.":
    "إطار متكامل لبناء تطبيقات ويب ديناميكية وجاهز للمؤسسات مع أدوات شاملة.",
  "JavaScript runtime for server-side development. Build scalable network applications with non-blocking I/O.":
    "بيئة تشغيل JavaScript للتطوير من جهة الخادم وبناء تطبيقات شبكية قابلة للتوسع.",
  "Containerization platform for consistent deployments. Simplify development and production environments.":
    "منصة حاويات لنشر متسق وتبسيط بيئات التطوير والإنتاج.",
  "Container orchestration platform for scaling applications. Manage and deploy containerized workloads effortlessly.":
    "منصة لإدارة الحاويات وتوسيع التطبيقات ونشر أحمال العمل بسهولة.",
  "The most popular language for web development. Perfect for full-stack applications with Node.js and modern frameworks.":
    "أشهر لغة لتطوير الويب، مناسبة للتطبيقات المتكاملة مع Node.js والأطر الحديثة.",
  Policy: "السياسة",
  Service: "الخدمة",
  "Your privacy is important to us. Learn how we collect, use, and protect your personal information.":
    "خصوصيتك مهمة لنا. تعرّف كيف نجمع معلوماتك الشخصية ونستخدمها ونحميها.",
  "Last Updated: April 18, 2026": "آخر تحديث: 18 أبريل 2026",
  "1. Information We Collect": "1. المعلومات التي نجمعها",
  "We collect information you provide directly to us, such as when you create an account, use our services, or contact us. This includes your name, email address, password, and any other information you choose to provide. We also automatically collect certain information about your device and how you interact with our services, including IP address, browser type, and usage data.":
    "نجمع المعلومات التي تقدمها لنا مباشرة، مثل إنشاء حساب أو استخدام خدماتنا أو التواصل معنا. يشمل ذلك اسمك وبريدك الإلكتروني وكلمة المرور وأي معلومات أخرى تختار تقديمها. نجمع أيضاً تلقائياً بعض معلومات جهازك وطريقة تفاعلك مع خدماتنا، مثل عنوان IP ونوع المتصفح وبيانات الاستخدام.",
  "2. How We Use Your Information": "2. كيف نستخدم معلوماتك",
  "We use the information we collect to provide, maintain, and improve our services, process transactions, send transactional and promotional communications, and comply with legal obligations. We may also use your information to personalize your experience, analyze usage patterns, and develop new features and services.":
    "نستخدم المعلومات التي نجمعها لتقديم خدماتنا وصيانتها وتحسينها، ومعالجة العمليات، وإرسال رسائل خدمية وترويجية، والامتثال للالتزامات القانونية. قد نستخدم معلوماتك أيضاً لتخصيص تجربتك وتحليل أنماط الاستخدام وتطوير ميزات وخدمات جديدة.",
  "3. Information Sharing": "3. مشاركة المعلومات",
  "We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating our website and conducting our business, subject to confidentiality agreements. We may also disclose information when required by law or to protect our rights and safety.":
    "لا نبيع معلوماتك الشخصية أو نتاجر بها أو نؤجرها لأطراف ثالثة. قد نشارك معلوماتك مع مزودي خدمات يساعدوننا في تشغيل الموقع وإدارة أعمالنا وفق اتفاقيات سرية. وقد نفصح عن المعلومات عندما يطلب القانون ذلك أو لحماية حقوقنا وسلامتنا.",
  "4. Data Security": "4. أمان البيانات",
  "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is completely secure. We cannot guarantee absolute security of your information.":
    "نطبق إجراءات تقنية وتنظيمية مناسبة لحماية معلوماتك الشخصية من الوصول أو التعديل أو الإفصاح أو الإتلاف غير المصرح به. لكن لا توجد طريقة نقل عبر الإنترنت أو تخزين إلكتروني آمنة بالكامل، لذلك لا يمكننا ضمان أمان مطلق لمعلوماتك.",
  "5. Cookies and Tracking": "5. ملفات تعريف الارتباط والتتبع",
  "We use cookies and similar tracking technologies to enhance your experience on our platform. These technologies help us remember your preferences, understand how you use our services, and deliver personalized content. You can control cookie settings through your browser, though some features may not function properly if cookies are disabled.":
    "نستخدم ملفات تعريف الارتباط وتقنيات مشابهة لتحسين تجربتك على منصتنا. تساعدنا هذه التقنيات على تذكر تفضيلاتك وفهم طريقة استخدامك لخدماتنا وتقديم محتوى مخصص. يمكنك التحكم بإعدادات ملفات الارتباط من المتصفح، لكن بعض الميزات قد لا تعمل بشكل صحيح عند تعطيلها.",
  "6. Your Rights and Choices": "6. حقوقك وخياراتك",
  "You have the right to access, update, or delete your personal information at any time by logging into your account or contacting us. You can also opt-out of promotional communications by following the unsubscribe instructions in our emails. Depending on your location, you may have additional rights regarding your personal data.":
    "لديك حق الوصول إلى معلوماتك الشخصية أو تحديثها أو حذفها في أي وقت عبر حسابك أو بالتواصل معنا. يمكنك أيضاً إلغاء الاشتراك في الرسائل الترويجية باتباع تعليمات الإلغاء في رسائلنا. وبحسب موقعك قد تكون لديك حقوق إضافية تخص بياناتك الشخصية.",
  "7. Data Retention": "7. الاحتفاظ بالبيانات",
  "We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this privacy policy. You can request deletion of your account and associated data at any time, subject to legal and operational requirements.":
    "نحتفظ بمعلوماتك الشخصية طالما كان ذلك ضرورياً لتقديم خدماتنا وتحقيق الأغراض الموضحة في سياسة الخصوصية. يمكنك طلب حذف حسابك والبيانات المرتبطة به في أي وقت، مع مراعاة المتطلبات القانونية والتشغيلية.",
  "8. Third-Party Links": "8. روابط الأطراف الثالثة",
  "Our website may contain links to third-party websites and services that are not operated by Gent. This privacy policy does not apply to third-party websites, and we are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services before providing your information.":
    "قد يحتوي موقعنا على روابط لمواقع وخدمات أطراف ثالثة لا تديرها Gent. لا تنطبق سياسة الخصوصية هذه على تلك المواقع، ولسنا مسؤولين عن ممارساتها. نشجعك على مراجعة سياسات الخصوصية لأي خدمة خارجية قبل تقديم معلوماتك.",
  "9. Children's Privacy": "9. خصوصية الأطفال",
  "Gent is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete such information and terminate the child's account.":
    "Gent غير مخصص للأطفال دون سن 13 عاماً. لا نجمع عمداً معلومات شخصية من الأطفال دون 13 عاماً. إذا علمنا أننا جمعنا معلومات من طفل دون 13 عاماً فسنتخذ خطوات لحذفها وإنهاء حساب الطفل.",
  "10. Changes to This Policy": "10. تغييرات هذه السياسة",
  "We may update this privacy policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website and updating the 'Last Updated' date. Your continued use of our services constitutes your acceptance of the updated policy.":
    "قد نحدث سياسة الخصوصية من وقت لآخر لتعكس تغييرات ممارساتنا أو لأسباب تشغيلية أو قانونية أو تنظيمية. سنبلغك بأي تغييرات جوهرية بنشر السياسة المحدثة على موقعنا وتحديث تاريخ آخر تحديث. استمرارك في استخدام خدماتنا يعني قبولك للسياسة المحدثة.",
  "11. Contact Us": "11. تواصل معنا",
  "If you have questions about this privacy policy or our privacy practices, please contact us at privacy@gent.com. We will respond to your inquiry within 30 days. You can also reach out to our Data Protection Officer for privacy-related concerns.":
    "إذا كانت لديك أسئلة حول سياسة الخصوصية أو ممارساتنا، فتواصل معنا على privacy@gent.com. سنرد على استفسارك خلال 30 يوماً. يمكنك أيضاً التواصل مع مسؤول حماية البيانات لأي مخاوف متعلقة بالخصوصية.",
  "Your Data Protection Rights": "حقوق حماية بياناتك",
  "We are committed to protecting your privacy and giving you control over your data":
    "نلتزم بحماية خصوصيتك ومنحك التحكم في بياناتك",
  active: "نشط",
  "Access Your Data": "الوصول إلى بياناتك",
  "You have the right to request and access all personal information we hold about you at any time.":
    "لديك حق طلب كل المعلومات الشخصية التي نحتفظ بها عنك والوصول إليها في أي وقت.",
  Update: "تحديث",
  "Update Information": "تحديث المعلومات",
  "Keep your information accurate and up-to-date. You can modify your profile details whenever needed.":
    "حافظ على دقة معلوماتك وحداثتها. يمكنك تعديل تفاصيل ملفك الشخصي عند الحاجة.",
  Delete: "حذف",
  "Delete Your Data": "حذف بياناتك",
  "Request deletion of your account and associated data. We'll process your request within 30 days.":
    "اطلب حذف حسابك والبيانات المرتبطة به. سنعالج طلبك خلال 30 يوماً.",
  Export: "تصدير",
  "Data Portability": "قابلية نقل البيانات",
  "Export your data in a standard format. Take your information with you if you decide to leave.":
    "صدّر بياناتك بصيغة قياسية لتأخذ معلوماتك معك إذا قررت المغادرة.",
  Control: "تحكم",
  "Opt-Out Options": "خيارات إلغاء الاشتراك",
  "Control your communication preferences. Unsubscribe from marketing emails anytime.":
    "تحكم بتفضيلات التواصل. يمكنك إلغاء رسائل التسويق في أي وقت.",
  Secure: "آمن",
  "Security Measures": "إجراءات الأمان",
  "We use encryption and security protocols to protect your data from unauthorized access.":
    "نستخدم التشفير وبروتوكولات الأمان لحماية بياناتك من الوصول غير المصرح به.",
  "Privacy Questions?": "أسئلة حول الخصوصية؟",
  "We take your privacy seriously. If you have any questions or concerns about how we handle your data, reach out to our privacy team.":
    "نتعامل مع خصوصيتك بجدية. إذا كانت لديك أسئلة أو مخاوف حول كيفية تعاملنا مع بياناتك، فتواصل مع فريق الخصوصية.",
  "Contact Privacy Team": "تواصل مع فريق الخصوصية",
  "Please read these terms carefully before using Gent. By accessing our services, you agree to be bound by these terms.":
    "يرجى قراءة هذه الشروط بعناية قبل استخدام Gent. باستخدام خدماتنا، فإنك توافق على الالتزام بهذه الشروط.",
  "1. Acceptance of Terms": "1. قبول الشروط",
  "2. Use License": "2. ترخيص الاستخدام",
  "3. Disclaimer": "3. إخلاء المسؤولية",
  "4. Limitations": "4. حدود المسؤولية",
  "5. Accuracy of Materials": "5. دقة المواد",
  "6. Materials and Content": "6. المواد والمحتوى",
  "7. Modifications": "7. التعديلات",
  "8. Governing Law": "8. القانون الحاكم",
  "9. User Accounts": "9. حسابات المستخدمين",
  "10. Prohibited Activities": "10. الأنشطة المحظورة",
  "11. Intellectual Property Rights": "11. حقوق الملكية الفكرية",
  "12. Limitation of Liability": "12. تحديد المسؤولية",
  "13. Contact Information": "13. معلومات التواصل",
  "Key Points to Remember": "نقاط مهمة يجب تذكرها",
  "Important highlights from our terms of service": "أهم النقاط من شروط الخدمة",
  "Your Responsibility": "مسؤوليتك",
  Rules: "القواعد",
  "Prohibited Activities": "الأنشطة المحظورة",
  Copyright: "حقوق النشر",
  "Intellectual Property": "الملكية الفكرية",
  Legal: "قانوني",
  "Limitation of Liability": "حدود المسؤولية",
  Updates: "التحديثات",
  "Changes to Terms": "تغييرات الشروط",
  Support: "الدعم",
  "Dispute Resolution": "حل النزاعات",
  "Questions About Our Terms?": "أسئلة حول شروطنا؟",
  "Contact Legal Team": "تواصل مع الفريق القانوني",
  "By accessing and using Gent, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service. We reserve the right to make changes to these terms at any time without notice.":
    "باستخدام Gent، فإنك تقبل هذه الاتفاقية وتوافق على الالتزام بشروطها وأحكامها. إذا لم توافق على ما سبق، يرجى عدم استخدام هذه الخدمة. نحتفظ بحق تعديل هذه الشروط في أي وقت دون إشعار.",
  "Quick Start with Gent": "بداية سريعة مع Gent",
  "Welcome back to Gent": "مرحباً بعودتك إلى Gent",
  "create one": "أنشئ حساباً",
  "Privacy Policy": "سياسة الخصوصية",
  "Terms of Service": "شروط الخدمة",
  "© 2026 Gent. All rights reserved.": "© 2026 Gent. جميع الحقوق محفوظة.",
  "Getting Started": "البدء",
  "Create your Gent account and start managing repositories":
    "أنشئ حساب Gent وابدأ إدارة المستودعات",
  "sign in": "تسجيل الدخول",
  "Learn How Gent Works": "تعرف كيف يعمل Gent",
  "Development Workflow": "سير عمل التطوير",
  "Discover best practices, insights, and strategies from industry leaders. Learn how top engineering teams build, deploy, and scale with confidence.":
    "اكتشف أفضل الممارسات والأفكار والاستراتيجيات من قادة المجال. تعلم كيف تبني فرق الهندسة القوية وتنشر وتتوسع بثقة.",
  "Repository Files": "ملفات المستودع",
  "Repository Management: Organize Your Code": "إدارة المستودعات: نظّم الكود",
  "Create, manage, and explore repositories while keeping your projects organized in one place.":
    "أنشئ المستودعات وأدرها واستكشفها مع إبقاء مشاريعك منظمة في مكان واحد.",
  Current: "الحالي",
  "Branch Management: Work on Different Versions": "إدارة الفروع: اعمل على إصدارات مختلفة",
  "Create branches, switch between them, and explore different versions of your project without changing the main branch.":
    "أنشئ فروعاً وبدّل بينها واستكشف إصدارات مختلفة من مشروعك دون تغيير الفرع الرئيسي.",
  "Account Access": "الوصول إلى الحساب",
  "Signed In": "تم تسجيل الدخول",
  "Account authenticated": "تمت مصادقة الحساب",
  "Password Recovery": "استعادة كلمة المرور",
  "Authentication: Secure Access to Your Account": "المصادقة: وصول آمن إلى حسابك",
  "Manage your Gent account with login, registration, password recovery, and password management features.":
    "أدر حساب Gent عبر تسجيل الدخول والتسجيل واستعادة كلمة المرور وميزات إدارة كلمة المرور.",
  Collaborators: "المتعاونون",
  "Repository Owner": "مالك المستودع",
  Owner: "المالك",
  Collaborator: "متعاون",
  Member: "عضو",
  Developer: "مطور",
  "Collaborators: Work Together on Repositories": "المتعاونون: اعملوا معاً على المستودعات",
  "Manage repository collaborators and control who can work with your projects.":
    "أدر متعاوني المستودع وتحكم بمن يمكنه العمل على مشاريعك.",
  "Repository Files: Explore Your Project": "ملفات المستودع: استكشف مشروعك",
  "Browse repository files and folders, switch branches, and inspect the contents of your project.":
    "تصفح ملفات ومجلدات المستودع، وبدّل الفروع، وافحص محتويات مشروعك.",
  "Update repository settings": "تحديث إعدادات المستودع",
  "Add repository files": "إضافة ملفات المستودع",
  "Files changed: 3": "الملفات المتغيرة: 3",
  "Compare changes": "مقارنة التغييرات",
  "Commits & Diff: Track and Compare Changes": "الالتزامات والفروقات: تتبع وقارن التغييرات",
  "Explore commit history and compare changes to understand exactly what was added, removed, or modified.":
    "استكشف سجل الالتزامات وقارن التغييرات لمعرفة ما تمت إضافته أو حذفه أو تعديله بدقة.",
  "Start Your Career with Gent": "ابدأ مسارك مع Gent",
  "Use Gent to create repositories, manage branches and members, and sync local work through the Gent CLI and API.":
    "استخدم Gent لإنشاء المستودعات وإدارة الفروع والأعضاء ومزامنة العمل المحلي عبر Gent CLI وAPI.",
  "Repository route is incomplete": "مسار المستودع غير مكتمل",
  "Repository pages need both an owner id and a repository name. Open a repository from the dashboard, or use a full URL like /dashboard/repository/1/my-repo.":
    "تحتاج صفحات المستودعات إلى معرف المالك واسم المستودع معاً. افتح المستودع من لوحة التحكم، أو استخدم رابطاً كاملاً مثل /dashboard/repository/1/my-repo.",
  "Back to Dashboard": "العودة إلى لوحة التحكم",
  "Browse repositories": "تصفح المستودعات",
  "How it works": "كيف يعمل",
  Services: "الخدمات",
  "cli · api · web": "سطر الأوامر · الواجهة البرمجية · الويب",
  Version: "تحكم",
  "control,": "بالإصدارات،",
  forged: "مصنوع",
  "green.": "بضوء أخضر.",
  "A lightweight Git-like CLI, a hosted API, and a dashboard that all speak the same objects — repositories, commits, branches, tags, files, and members.":
    "أداة خفيفة شبيهة بـ Git، وواجهة برمجية مستضافة، ولوحة تحكم تتعامل جميعها مع الكائنات نفسها — المستودعات والالتزامات والفروع والوسوم والملفات والأعضاء.",
  "Open the Dashboard": "فتح لوحة التحكم",
  "core object types": "أنواع كائنات أساسية",
  "content addressed": "محتوى معنون بالتجزئة",
  "Every surface below is wired to the current CLI, API, and dashboard — not a mockup.":
    "كل واجهة أدناه متصلة فعلياً بأداة سطر الأوامر والواجهة البرمجية ولوحة التحكم الحالية — وليست نموذجاً تجريبياً.",
  "Initialize repos, stage files, commit, push, pull, and clone straight from your shell against the Gent API.":
    "أنشئ المستودعات وجهز الملفات وسجل التغييرات وادفع واسحب واستنسخ مباشرة من الطرفية عبر واجهة Gent البرمجية.",
  "Open files from the dashboard, switch branches, read blobs, and create small text files in place.":
    "افتح الملفات من لوحة التحكم، وبدّل الفروع، واقرأ كائنات Blob، وأنشئ الملفات النصية الصغيرة مباشرة.",
  "Fork branches from any commit and keep each branch tree isolated in the Code tab.":
    "أنشئ فروعاً من أي التزام واحتفظ بشجرة كل فرع مستقلة في تبويب الملفات.",
  "Review commit lists and diffs rendered from the exact backend data the CLI writes.":
    "راجع قوائم الالتزامات والفروقات المعروضة من بيانات الخادم نفسها التي تكتبها أداة سطر الأوامر.",
  "Push & Pull": "الدفع والسحب",
  "Sync local objects with hosted repositories through Gent push packs and pull endpoints.":
    "زامن الكائنات المحلية مع المستودعات المستضافة عبر حزم الدفع ونقاط السحب في Gent.",
  "Access Control": "التحكم في الوصول",
  "Private repositories and member roles enforced by the Gent backend permission model.":
    "يفرض نموذج صلاحيات خادم Gent حماية المستودعات الخاصة وأدوار الأعضاء.",
  "The path of a commit": "مسار الالتزام",
  "From your shell to the web.": "من طرفيتك إلى الويب.",
  "01 · Local": "01 · محلي",
  "The CLI writes objects": "أداة سطر الأوامر تكتب الكائنات",
  "Every add and commit hashes content into local Gent objects — the same shape the server understands.":
    "تجزئ كل عملية إضافة والتزام المحتوى إلى كائنات Gent محلية — بالصيغة نفسها التي يفهمها الخادم.",
  "02 · API": "02 · الواجهة البرمجية",
  "Push packs hit the API": "حزم الدفع تصل إلى الواجهة البرمجية",
  "Push bundles objects to gent-api.onrender.com and clone pulls them back by owner-id URL.":
    "يجمع الدفع الكائنات ويرسلها إلى gent-api.onrender.com، بينما يستعيدها الاستنساخ عبر رابط معرف المالك.",
  "03 · Web": "03 · الويب",
  "The dashboard reads them": "لوحة التحكم تقرؤها",
  "Repositories, branches, commits, trees, blobs, tags and members render from those same endpoints.":
    "تُعرض المستودعات والفروع والالتزامات والأشجار وكائنات Blob والوسوم والأعضاء من نقاط الاتصال نفسها.",
  "Spin up your first repository.": "أنشئ مستودعك الأول.",
  "Install the CLI, push a commit, and watch it appear in the dashboard seconds later.":
    "ثبّت أداة سطر الأوامر، وادفع التزاماً، وشاهده يظهر في لوحة التحكم خلال ثوانٍ.",
  "A lightweight version control system — a Git-like CLI, a hosted API, and a web dashboard that read from the same objects.":
    "نظام خفيف للتحكم بالإصدارات — أداة سطر أوامر شبيهة بـ Git، وواجهة برمجية مستضافة، ولوحة ويب تقرأ جميعها من الكائنات نفسها.",
  Product: "المنتج",
  Overview: "نظرة عامة",
  Developers: "المطورون",
  "Create account": "إنشاء حساب",
  "© 2026 Gent. Built for developers.": "© 2026 Gent. صُمم للمطورين.",
  "Gent, explained.": "Gent، ببساطة.",
  "Short guides to every core feature — repositories, branches, auth, collaborators, files, and commits.":
    "أدلة قصيرة لكل ميزة أساسية — المستودعات والفروع والمصادقة والمتعاونون والملفات والالتزامات.",
  "Create branches, switch between them, and explore different versions of your project without touching main.":
    "أنشئ الفروع وبدّل بينها واستكشف إصدارات مختلفة من مشروعك دون المساس بالفرع الرئيسي.",
  Authentication: "المصادقة",
  "Login, registration, password recovery, and password management for your Gent account.":
    "تسجيل الدخول وإنشاء الحساب واستعادة كلمة المرور وإدارتها لحساب Gent الخاص بك.",
  "File Browser": "متصفح الملفات",
  "Browse files and folders, switch branches, and inspect the contents of your project.":
    "تصفح الملفات والمجلدات، وبدّل الفروع، وافحص محتويات مشروعك.",
  "Explore commit history and compare changes to see exactly what was added, removed, or modified.":
    "استكشف سجل الالتزامات وقارن التغييرات لمعرفة ما أضيف أو حُذف أو عُدل بدقة.",
  "grouped by flow.": "مرتبة حسب سير العمل.",
  "The checked-in Gent CLI reference, kept in lock-step with the backend API contract.":
    "مرجع أداة Gent الموجود في المشروع، والمتوافق بدقة مع عقد الواجهة البرمجية للخادم.",
  "quick start": "بداية سريعة",
  "your projects.": "لمشاريعك.",
  "Version control and collaboration built to streamline your workflow — from repository management to team access.":
    "تحكم بالإصدارات وتعاون صُمما لتبسيط سير عملك — من إدارة المستودعات إلى وصول الفريق.",
  "Start new project": "بدء مشروع جديد",
  "Our core services": "خدماتنا الأساسية",
  "Comprehensive solutions for modern development teams.": "حلول متكاملة لفرق التطوير الحديثة.",
  "Create, clone, and organize projects with an interface built around Gent objects.":
    "أنشئ المشاريع واستنسخها ونظمها بواجهة مبنية حول كائنات Gent.",
  "Real-time updates, comments, and notifications keep everyone in sync.":
    "تبقي التحديثات والتعليقات والإشعارات الفورية الجميع متزامنين.",
  "Review code changes before merging and keep quality standards high.":
    "راجع تغييرات الكود قبل الدمج وحافظ على معايير جودة عالية.",
  "Role-based access control and private repositories enforced by the backend.":
    "يفرض الخادم التحكم في الوصول حسب الدور وحماية المستودعات الخاصة.",
  "Clone, commit, and push operations complete in seconds.":
    "تكتمل عمليات الاستنساخ والالتزام والدفع خلال ثوانٍ.",
  "Automate testing and deployment with the tools you already use.":
    "أتمت الاختبار والنشر باستخدام الأدوات التي تعتمدها بالفعل.",
  "Why developers choose Gent": "لماذا يختار المطورون Gent",
  "Features that make everyday development easier.": "ميزات تجعل التطوير اليومي أسهل.",
  "Minimal resource usage with maximum performance from an optimized architecture.":
    "استخدام منخفض للموارد مع أعلى أداء بفضل بنية محسّنة.",
  "Built by developers for developers — no steep learning curve.":
    "بناه مطورون للمطورين — دون منحنى تعلم معقد.",
  "Grow your projects without limits; the infrastructure scales with you.":
    "نمِّ مشاريعك بلا حدود؛ فالبنية التحتية تتوسع معك.",
  "Works with your stack": "يعمل مع تقنياتك",
  "Compatible with all major languages and frameworks.": "متوافق مع أهم اللغات وأطر العمل.",
  "Build your next project on Gent": "ابنِ مشروعك القادم على Gent",
  "Create repositories, manage branches and members, and sync local work through the Gent CLI and API.":
    "أنشئ المستودعات وأدر الفروع والأعضاء وزامن عملك المحلي عبر أداة Gent وواجهتها البرمجية.",
  "answered.": "بإجابات واضحة.",
  "Focused on what exists now — the CLI, backend API, dashboard, repositories, files, branches, members, and account flows.":
    "نركز على الموجود فعلياً — أداة سطر الأوامر وواجهة الخادم ولوحة التحكم والمستودعات والملفات والفروع والأعضاء ومسارات الحساب.",
  "How Gent collects, uses, and protects your personal information.":
    "كيف تجمع Gent معلوماتك الشخصية وتستخدمها وتحميها.",
  "Last updated: August 2026": "آخر تحديث: أغسطس 2026",
  "The terms that govern your use of Gent's CLI, API, and web dashboard.":
    "الشروط التي تحكم استخدامك لأداة Gent وواجهتها البرمجية ولوحة الويب.",
  "you pushed.": "بعودتك.",
  "Your repositories, branches, and commits are waiting — synced from the same objects your CLI writes.":
    "مستودعاتك وفروعك والتزاماتك بانتظارك — متزامنة من الكائنات نفسها التي تكتبها أداة سطر الأوامر.",
  "← Back to Gent": "العودة إلى Gent →",
  "Access your Gent dashboard.": "ادخل إلى لوحة تحكم Gent.",
  "one commit away.": "على بُعد التزام واحد.",
  "Create an account, install the CLI, and push code that shows up in your dashboard seconds later.":
    "أنشئ حساباً وثبّت أداة سطر الأوامر وادفع كوداً يظهر في لوحة تحكمك خلال ثوانٍ.",
  "Start managing repositories with Gent.": "ابدأ إدارة المستودعات باستخدام Gent.",
  "Reset password": "إعادة تعيين كلمة المرور",
  "Enter your new password below.": "أدخل كلمة المرور الجديدة أدناه.",
  "New password": "كلمة المرور الجديدة",
  "Confirm password": "تأكيد كلمة المرور",
  "Back to login": "العودة إلى تسجيل الدخول",
  "Gent version control · CLI + API + Web": "نظام Gent للتحكم بالإصدارات · سطر الأوامر + الواجهة البرمجية + الويب",
  "CLI · API · Web": "سطر الأوامر · الواجهة البرمجية · الويب",
  "Gent. Built for developers.": "Gent. صُمم للمطورين.",
  "The mechanics of": "آلية عمل",
  "Every Gent command,": "كل أوامر Gent،",
  "Powerful services for": "خدمات قوية",
  "Questions,": "أسئلة،",
  "Invalid reset link": "رابط إعادة التعيين غير صالح",
  "Passwords do not match": "كلمتا المرور غير متطابقتين",
  "Password must be at least 8 characters": "يجب ألا تقل كلمة المرور عن 8 أحرف",
  "Password reset successfully!": "تمت إعادة تعيين كلمة المرور بنجاح!",
  "Failed to reset password": "فشلت إعادة تعيين كلمة المرور",
  "Password reset!": "تمت إعادة تعيين كلمة المرور!",
  "Redirecting you to the login page…": "جار تحويلك إلى صفحة تسجيل الدخول…",
  "Go to login": "الذهاب إلى تسجيل الدخول",
  "Enter new password": "أدخل كلمة المرور الجديدة",
  "Confirm new password": "أكد كلمة المرور الجديدة",
  "Resetting…": "جار إعادة التعيين…",
  "Last updated:": "آخر تحديث:",
  "August 2026": "أغسطس 2026",
  "Gent provides a simple way to create and manage software repositories from one place.":
    "يوفر Gent طريقة بسيطة لإنشاء مستودعات البرامج وإدارتها من مكان واحد.",
  "Create a Repository": "إنشاء مستودع",
  "Start a new project by creating a repository and providing the basic information about your project. You can define the name, description, and visibility to fit your project.":
    "ابدأ مشروعاً جديداً بإنشاء مستودع وإضافة معلومات مشروعك الأساسية. يمكنك تحديد الاسم والوصف ومستوى الظهور بما يناسب مشروعك.",
  "Manage Repository Information": "إدارة معلومات المستودع",
  "Repository owners can update repository information when project details change. Gent keeps management organized so users easily access their projects.":
    "يمكن لمالكي المستودعات تحديث معلوماتها عند تغير تفاصيل المشروع. يحافظ Gent على تنظيم الإدارة ليسهل على المستخدمين الوصول إلى مشاريعهم.",
  "Explore Your Repository": "استكشف مستودعك",
  "After creating a repository, explore its branches, files, commits, and other available information.":
    "بعد إنشاء المستودع، استكشف فروعه وملفاته والتزاماته والمعلومات الأخرى المتاحة.",
  "Repository Ownership": "ملكية المستودع",
  "Permissions are managed by role. Owners get management actions; other users get access according to the permissions granted to them.":
    "تُدار الصلاحيات حسب الدور. يحصل المالكون على إجراءات الإدارة، بينما يصل المستخدمون الآخرون وفق الصلاحيات الممنوحة لهم.",
  "Branches let developers work on different versions of a project while keeping the main line organized.":
    "تتيح الفروع للمطورين العمل على إصدارات مختلفة من المشروع مع إبقاء المسار الرئيسي منظماً.",
  "Create a Branch": "إنشاء فرع",
  "Create a new branch from an existing one to work on a feature or make changes independently.":
    "أنشئ فرعاً جديداً من فرع موجود للعمل على ميزة أو إجراء تغييرات بصورة مستقلة.",
  "Switch Between Branches": "التبديل بين الفروع",
  "Select a branch and explore the files that belong to it — making it easy to work with different versions of the same repository.":
    "اختر فرعاً واستكشف ملفاته — لتعمل بسهولة على إصدارات مختلفة من المستودع نفسه.",
  "Branch Files": "ملفات الفرع",
  "Each branch can contain its own version of the files. When you switch, Gent loads the corresponding tree so you explore the correct version.":
    "يمكن أن يحتوي كل فرع على إصداره الخاص من الملفات. عند التبديل، يحمّل Gent الشجرة المقابلة لتستكشف الإصدار الصحيح.",
  "A Typical Workflow": "سير عمل نموذجي",
  "Select a branch, create a new one when needed, make changes, commit, and compare when necessary.":
    "اختر فرعاً، وأنشئ فرعاً جديداً عند الحاجة، ثم غيّر وسجل وقارن عند الضرورة.",
  "Authentication lets users securely access their accounts and repository features.":
    "تتيح المصادقة للمستخدمين الوصول بأمان إلى حساباتهم وميزات المستودعات.",
  "Create an Account": "إنشاء حساب",
  "New users register through the registration form, then sign in and access their Gent workspace.":
    "يسجل المستخدمون الجدد عبر نموذج إنشاء الحساب، ثم يسجلون الدخول إلى مساحة عمل Gent.",
  Login: "تسجيل الدخول",
  "Registered users sign in with their credentials. Authentication keeps personal repositories tied to the correct user.":
    "يسجل المستخدمون المسجلون الدخول ببياناتهم. وتضمن المصادقة ربط المستودعات الشخصية بالمستخدم الصحيح.",
  "Forgot & Reset Password": "نسيان كلمة المرور وإعادة تعيينها",
  "If a user forgets their password, Gent provides a recovery flow, and users set a new password through the reset process.":
    "إذا نسي المستخدم كلمة مروره، يوفر Gent مسار استعادة يتيح تعيين كلمة مرور جديدة.",
  "Authenticated users can change their current password from account settings.":
    "يمكن للمستخدمين المصادق عليهم تغيير كلمة المرور الحالية من إعدادات الحساب.",
  "Gent provides collaboration features that let owners manage who works with their projects.":
    "يوفر Gent ميزات تعاون تتيح للمالكين إدارة من يعمل على مشاريعهم.",
  "Add Collaborators": "إضافة متعاونين",
  "Owners add users as collaborators when they want other developers to work with the repository.":
    "يضيف المالكون المستخدمين كمتعاونين عندما يرغبون في مشاركة العمل على المستودع مع مطورين آخرين.",
  "Manage Access": "إدارة الوصول",
  "Collaborators receive access according to the permissions provided, so owners keep control over important actions.":
    "يحصل المتعاونون على الوصول وفق الصلاحيات الممنوحة، ليحتفظ المالكون بالتحكم في الإجراءات المهمة.",
  "The owner remains responsible for the repository; some actions are restricted to users with the required permissions.":
    "يبقى المالك مسؤولاً عن المستودع، وتُحصر بعض الإجراءات بالمستخدمين ذوي الصلاحيات المطلوبة.",
  "Working Together": "العمل معاً",
  "Create a repository, add collaborators, branch for tasks, commit changes, then review and compare.":
    "أنشئ مستودعاً، وأضف المتعاونين، وأنشئ فروعاً للمهام، وسجل التغييرات، ثم راجع وقارن.",
  "Gent's file browser lets you explore the structure and contents of your projects.":
    "يتيح لك متصفح ملفات Gent استكشاف بنية مشاريعك ومحتوياتها.",
  "Browse Files and Folders": "تصفح الملفات والمجلدات",
  "Open a repository and navigate its folders and files. The tree makes it easy to understand a project's structure without leaving the platform.":
    "افتح مستودعاً وتنقل بين مجلداته وملفاته. تسهّل الشجرة فهم بنية المشروع دون مغادرة المنصة.",
  "Explore a Branch": "استكشف فرعاً",
  "The browser works with branches — select a branch and view the files belonging to that version.":
    "يعمل المتصفح مع الفروع — اختر فرعاً واعرض الملفات التابعة لذلك الإصدار.",
  "Open & Create Files": "فتح الملفات وإنشاؤها",
  "Select a file to inspect its contents. Users with permission can create files, which become part of the repository structure.":
    "اختر ملفاً لفحص محتواه. ويمكن للمستخدمين المخولين إنشاء ملفات تصبح جزءاً من بنية المستودع.",
  "Commits provide a history of changes to a repository. Gent lets you explore that history and inspect individual commits.":
    "توفر الالتزامات سجلاً لتغييرات المستودع. ويتيح لك Gent استكشاف هذا السجل وفحص كل التزام.",
  "View the history and inspect the changes for previous commits. Each commit carries identifying information about when and how a change was made.":
    "اعرض السجل وافحص تغييرات الالتزامات السابقة. يحمل كل التزام معلومات تحدد وقت التغيير وكيفية إجرائه.",
  "Commit Details": "تفاصيل الالتزام",
  "Opening a commit provides more information about the selected change, helping you understand the evolution of your project.":
    "يوفر فتح الالتزام معلومات إضافية عن التغيير المحدد، مما يساعدك على فهم تطور مشروعك.",
  "Compare Changes": "مقارنة التغييرات",
  "The diff view compares versions of the code — added and removed lines can be inspected directly.":
    "تقارن واجهة الفروقات بين إصدارات الكود — ويمكن فحص الأسطر المضافة والمحذوفة مباشرة.",
  "Development History": "سجل التطوير",
  "Combining branches, commits, and diffs gives a clearer picture of how your repository changes over time.":
    "يمنحك الجمع بين الفروع والالتزامات والفروقات صورة أوضح لكيفية تغير مستودعك مع الوقت.",
  "Independent version control · CLI + API + Web":
    "تحكم مستقل بالإصدارات · سطر الأوامر + الواجهة البرمجية + الويب",
  "Gent gives you a Git-like CLI, a hosted API, and a visual dashboard for repositories, branches, commits, files, tags, and access — all working from the same version-control data.":
    "يمنحك Gent أداة سطر أوامر شبيهة بـ Git، وواجهة برمجية مستضافة، ولوحة تحكم مرئية للمستودعات والفروع والالتزامات والملفات والوسوم والصلاحيات — تعمل جميعها من بيانات التحكم بالإصدارات نفسها.",
  "Scroll through a commit": "مرّر عبر رحلة الالتزام",
  "One history. Three connected surfaces.": "سجل واحد. ثلاث واجهات مترابطة.",
  "Your files become versioned objects": "تتحول ملفاتك إلى كائنات ذات إصدارات",
  "Gent hashes staged files and commits into a local history you can inspect and move between.":
    "يجزّئ Gent الملفات المجهزة والالتزامات إلى سجل محلي يمكنك فحصه والتنقل بين نقاطه.",
  "One push connects every object": "دفعة واحدة تربط كل الكائنات",
  "The CLI sends the exact commit, tree, and blob data the Gent API understands.":
    "ترسل أداة سطر الأوامر بيانات الالتزام والشجرة وكائنات Blob الدقيقة التي تفهمها واجهة Gent البرمجية.",
  "The dashboard makes history visible": "لوحة التحكم تجعل السجل مرئياً",
  "Branches, files, commits, tags, and members become one navigable project view.":
    "تصبح الفروع والملفات والالتزامات والوسوم والأعضاء واجهة مشروع واحدة قابلة للتنقل.",
  "local objects": "الكائنات المحلية",
  "API sync": "مزامنة الواجهة البرمجية",
  "web dashboard": "لوحة تحكم الويب",
  "control room": "غرفة التحكم",
  "Live workspace": "مساحة عمل مباشرة",
  "Your development control room.": "غرفة التحكم بتطويرك.",
  "Repositories, access, branches, and recent activity in one connected workspace.":
    "المستودعات والصلاحيات والفروع والنشاط الحديث في مساحة عمل واحدة مترابطة.",
  "Refresh data": "تحديث البيانات",
  "Repository space": "مساحة المستودعات",
};

const dynamicTranslations: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^Manage your (\d+) repositories$/, (m) => `إدارة ${m[1]} مستودعات`],
  [/^(\d+) repos$/, (m) => `${m[1]} مستودعات`],
  [/^(\d+) visible$/, (m) => `${m[1]} ظاهر`],
  [/^Fast-forward: (\d+) new commit\(s\)$/, (m) => `تقديم سريع: ${m[1]} التزام جديد`],
  [/^Merged (\d+) remote commit\(s\)$/, (m) => `تم دمج ${m[1]} التزام بعيد`],
  [/^Permission is granted to temporarily download one copy/, () =>
    "يُمنح إذن بتنزيل نسخة مؤقتة واحدة من مواد Gent للاطلاع الشخصي غير التجاري فقط. هذا ترخيص وليس نقل ملكية، وبموجبه لا يجوز تعديل المواد أو نسخها أو استخدامها تجارياً أو عرضها عاماً أو تفكيك البرامج أو إزالة إشعارات الملكية أو نقل المواد لشخص آخر أو خادم آخر."],
  [/^The materials on Gent are provided on an 'as is' basis/, () =>
    "تُقدم مواد Gent كما هي. لا تقدم Gent أي ضمانات صريحة أو ضمنية، وتخلي مسؤوليتها عن أي ضمانات أخرى، بما في ذلك الملاءمة لغرض معين أو عدم انتهاك حقوق الملكية الفكرية."],
  [/^In no event shall Gent or its suppliers be liable for any damages/, () =>
    "لا تتحمل Gent أو مورّدوها في أي حال مسؤولية أي أضرار، بما في ذلك فقدان البيانات أو الأرباح أو توقف الأعمال، الناتجة عن استخدام مواد Gent أو عدم القدرة على استخدامها، حتى لو تم إخطار Gent باحتمال وقوع هذه الأضرار."],
  [/^The materials appearing on Gent could include technical/, () =>
    "قد تحتوي المواد المعروضة على Gent على أخطاء تقنية أو مطبعية أو تصويرية. لا تضمن Gent أن تكون المواد دقيقة أو كاملة أو حديثة، وقد تغيرها في أي وقت دون إشعار."],
  [/^Gent has not reviewed all of the sites linked to its website/, () =>
    "لم تراجع Gent جميع المواقع المرتبطة بموقعها ولا تتحمل مسؤولية محتواها. وجود أي رابط لا يعني تأييد Gent لذلك الموقع، واستخدامه يكون على مسؤولية المستخدم."],
  [/^Gent may revise these terms of service/, () =>
    "قد تراجع Gent شروط الخدمة الخاصة بموقعها في أي وقت دون إشعار. باستخدام هذا الموقع، فإنك توافق على الالتزام بالنسخة الحالية من هذه الشروط."],
  [/^These terms and conditions are governed by/, () =>
    "تخضع هذه الشروط وتفسر وفق قوانين الجهة التي تعمل فيها Gent، وتوافق على الاختصاص الحصري للمحاكم في ذلك الموقع. إذا أصبح أي بند غير صالح، تبقى البنود الأخرى نافذة."],
  [/^If you create an account on Gent/, () =>
    "إذا أنشأت حساباً على Gent، فأنت مسؤول عن سرية معلومات حسابك وكلمة مرورك وعن تقييد الوصول إلى جهازك. يجب إبلاغنا فوراً بأي استخدام غير مصرح به لحسابك."],
  [/^You agree not to use Gent for any unlawful purpose/, () =>
    "توافق على عدم استخدام Gent لأي غرض غير قانوني أو بطريقة قد تضر الخدمة أو تعطلها أو تضعفها، بما في ذلك المضايقة أو المحتوى المسيء أو محاولة الوصول غير المصرح به إلى أنظمتنا."],
  [/^All content included on Gent/, () =>
    "كل المحتوى الموجود على Gent، مثل النصوص والرسومات والشعارات والصور والبرامج، هو ملك لـ Gent أو مزودي المحتوى ومحمي بقوانين حقوق النشر الدولية."],
  [/^In no event shall Gent, its directors/, () =>
    "لا تتحمل Gent أو مديروها أو موظفوها أو وكلاؤها مسؤولية أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو عقابية ناتجة عن استخدامك للموقع أو شروط الخدمة."],
  [/^If you have any questions about these Terms of Service/, () =>
    "إذا كانت لديك أسئلة حول شروط الخدمة هذه، فتواصل معنا على legal@gent.com. سنرد خلال 30 يوماً، ويمكنك أيضاً التواصل مع فريقنا القانوني لأي مخاوف أو نزاعات."],
  [/^You are responsible for maintaining the confidentiality/, () =>
    "أنت مسؤول عن الحفاظ على سرية حسابك وكلمة مرورك. حافظ على بيانات تسجيل الدخول آمنة دائماً."],
  [/^Do not engage in unlawful activities/, () =>
    "لا تشارك في أنشطة غير قانونية أو مضايقات أو محاولات تعطيل خدماتنا. احترم المستخدمين الآخرين والمنصة."],
  [/^All content on Gent is protected by copyright/, () =>
    "كل محتوى Gent محمي بحقوق النشر. لا تعيد إنتاج موادنا أو تعديلها أو توزيعها دون إذن."],
  [/^Gent is provided 'as is'/, () =>
    "تُقدم Gent كما هي. لا نتحمل مسؤولية الأضرار أو الخسائر غير المباشرة الناتجة عن استخدام خدماتنا."],
  [/^We may modify these terms at any time/, () =>
    "قد نعدل هذه الشروط في أي وقت. استمرارك في استخدام خدماتنا يعني قبولك للشروط المحدثة."],
  [/^Any disputes will be governed by applicable law/, () =>
    "ستخضع أي نزاعات للقانون المعمول به. تواصل مع الفريق القانوني لأي مخاوف أو نزاعات."],
  [/^If you have any questions or concerns about these terms of service/, () =>
    "إذا كانت لديك أي أسئلة أو مخاوف حول شروط الخدمة، فإن فريقنا القانوني جاهز للمساعدة. تواصل معنا في أي وقت."],
];

const originalTextNodes = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<HTMLElement, Record<string, string>>();

function translateText(value: string, language: Language): string {
  if (language === "en") return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return value;

  const direct = translations[trimmed];
  if (direct) return `${leading}${direct}${trailing}`;

  for (const [pattern, replacer] of dynamicTranslations) {
    const match = trimmed.match(pattern);
    if (match) return `${leading}${replacer(match)}${trailing}`;
  }

  return value;
}

function isTranslatedFromOriginal(
  current: string,
  original: string,
  language: Language,
) {
  return language === "ar" && current === translateText(original, language);
}

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("script,style,code,pre,kbd,samp,textarea,[data-no-translate]"));
}

function translateDocument(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    if (shouldSkipNode(node)) continue;
    const current = node.nodeValue ?? "";
    const savedOriginal = originalTextNodes.get(node);
    let original = savedOriginal ?? current;

    if (
      savedOriginal &&
      language === "en" &&
      current !== savedOriginal &&
      !isTranslatedFromOriginal(current, savedOriginal, "ar")
    ) {
      original = current;
      originalTextNodes.set(node, original);
    } else if (
      savedOriginal &&
      language === "ar" &&
      current !== savedOriginal &&
      !isTranslatedFromOriginal(current, savedOriginal, language)
    ) {
      original = current;
      originalTextNodes.set(node, original);
    } else if (!savedOriginal) {
      originalTextNodes.set(node, original);
    }

    const translated = translateText(original, language);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  document.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((element) => {
    const originals = originalAttributes.get(element) ?? {};
    for (const attr of ["placeholder", "title", "aria-label"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const savedOriginal = originals[attr];
      let original = savedOriginal ?? value;

      if (
        savedOriginal &&
        language === "en" &&
        value !== savedOriginal &&
        !isTranslatedFromOriginal(value, savedOriginal, "ar")
      ) {
        original = value;
      } else if (
        savedOriginal &&
        language === "ar" &&
        value !== savedOriginal &&
        !isTranslatedFromOriginal(value, savedOriginal, language)
      ) {
        original = value;
      }

      originals[attr] = original;
      const translated = translateText(original, language);
      if (value !== translated) element.setAttribute(attr, translated);
    }
    originalAttributes.set(element, originals);
  });
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  translate: (value: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "ar" || saved === "en") setLanguageState(saved);
  }, []);

  useEffect(() => {
    translateDocument(language);
    const observer = new MutationObserver(() => translateDocument(language));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (nextLanguage: Language) => {
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
      setLanguageState(nextLanguage);
    };

    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "ar" : "en"),
      translate: (valueToTranslate) => translateText(valueToTranslate, language),
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export function LanguageToggle({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={className}
      aria-label="Change language"
      title="Change language"
      {...props}
    >
      {language === "ar" ? "EN" : "AR"}
    </button>
  );
}
