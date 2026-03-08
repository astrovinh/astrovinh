export interface Translations {
  nav: { features: string; how: string; join: string };
  badge: string;
  hero: { h1a: string; h1b: string; sub: string };
  waitlist: {
    placeholder: string;
    btn: string;
    count: string;
    success: string;
    successSub: string;
  };
  problem: {
    label: string;
    h2a: string;
    h2b: string;
    items: { emoji: string; title: string; body: string }[];
  };
  features: {
    label: string;
    h2a: string;
    h2b: string;
    items: { icon: string; title: string; body: string; tag: string }[];
  };
  how: {
    label: string;
    h2a: string;
    h2b: string;
    steps: { step: string; title: string; body: string; icon: string }[];
  };
  social: {
    stats: { value: string; label: string }[];
    quote: string;
    author: string;
  };
  audience: {
    label: string;
    h2a: string;
    h2b: string;
    items: { who: string; desc: string; icon: string }[];
  };
  cta: { h2a: string; h2b: string; sub: string; success: string; successSub: string };
  footer: { tagline: string; copy: string };
}

export const translations: Record<"en" | "vi", Translations> = {
  en: {
    nav: { features: "Features", how: "How it works", join: "Join waitlist" },
    badge: "Level up your vibe coding",
    hero: {
      h1a: "Learn to vibe code",
      h1b: "with your own AI coding pet",
      sub: "DevPet is an AI companion that tracks your coding sessions, teaches you best practices, and helps you go from first prompt to production — all guided by a pet mentor that learns alongside you.",
    },
    waitlist: {
      placeholder: "Your email address",
      btn: "Join waitlist →",
      count: "people already on the waitlist",
      success: "You're on the list!",
      successSub: "We'll reach out when DevPet is ready.",
    },
    problem: {
      label: "The problem",
      h2a: "Everyone's vibe coding.",
      h2b: "Nobody's teaching how to do it well.",
      items: [
        { emoji: "😰", title: "Stuck in retry loops", body: "You prompt, get an error, rephrase, get a different error, repeat. 20 minutes gone." },
        { emoji: "🤷", title: "No project foundation", body: "No rules file, no README, no design system. AI guesses your preferences every time." },
        { emoji: "📈", title: "Can't measure growth", body: "You have no idea if you're getting better. Each session feels like starting from scratch." },
      ],
    },
    features: {
      label: "Features",
      h2a: "A coding companion that",
      h2b: "actually makes you better",
      items: [
        { icon: "📖", title: "Session storytelling", body: "Every coding session becomes a story with lessons, tips, and milestones — not a log, a learning experience.", tag: "Live" },
        { icon: "🌳", title: "Skill tree progression", body: "16 skills across 4 tiers — from Prompt Clarity to AI Architecture. Level up by actually coding.", tag: "Learn" },
        { icon: "🔍", title: "Project health analysis", body: "DevPet scans for missing docs, rules files, design inconsistencies, and messy structure — then teaches you to fix them.", tag: "Analyze" },
        { icon: "😺", title: "Pet mentor chat", body: "Tap your pet anytime to ask questions. It knows your project, your history, and your skill level.", tag: "Guide" },
        { icon: "📊", title: "Weekly insights", body: "AI-generated growth reports with lessons learned, error patterns, cost tracking, and recommendations.", tag: "Reflect" },
        { icon: "🎯", title: "Auto-detected sessions", body: "No buttons to press. DevPet detects when you open Cursor, VS Code, or any AI tool automatically.", tag: "Effortless" },
      ],
    },
    how: {
      label: "How it works",
      h2a: "Three steps to better",
      h2b: "vibe coding",
      steps: [
        { step: "01", title: "Install & code", body: "Download DevPet. Open your favorite AI coding tool. That's it — DevPet starts watching and learning your patterns automatically.", icon: "⚡" },
        { step: "02", title: "Learn as you build", body: "Get real-time tips when you're stuck, celebrate milestones, and receive plain-language explanations of what went wrong and why.", icon: "🐾" },
        { step: "03", title: "Grow over time", body: "Review daily recaps, track skill progression, and watch your error rate drop week over week.", icon: "📈" },
      ],
    },
    social: {
      stats: [
        { value: "847+", label: "Waitlist signups" },
        { value: "16", label: "Vibe coding skills" },
        { value: "4", label: "Skill tiers" },
        { value: "∞", label: "Pet patience" },
      ],
      quote: "I went from getting stuck for 20 minutes on every CSS error to resolving them in under 3 minutes. DevPet didn't just teach me prompting — it taught me how to think about AI as a tool.",
      author: "Early beta tester",
    },
    audience: {
      label: "Who is this for",
      h2a: "Whether you're writing your first prompt",
      h2b: "or shipping your tenth app",
      items: [
        { who: "Complete beginners", desc: "Never vibe coded before? DevPet walks you through your first project in 10 minutes.", icon: "🌱" },
        { who: "Solo builders", desc: "Building side projects with AI? Learn to set up projects so AI tools work 10× better.", icon: "🛠️" },
        { who: "Aspiring engineers", desc: "Want proper AI-native engineering skills? DevPet teaches the meta-skills that compound.", icon: "🚀" },
      ],
    },
    cta: {
      h2a: "Ready to level up your",
      h2b: "vibe coding?",
      sub: "others waiting for DevPet. We'll let you know when it's ready.",
      success: "Welcome to the waitlist!",
      successSub: "Your pet will be waiting for you.",
    },
    footer: {
      tagline: "Level up your vibe coding · Coming soon",
      copy: "© 2026 DevPet. Built with vibes.",
    },
  },
  vi: {
    nav: { features: "Tính năng", how: "Cách hoạt động", join: "Đăng ký" },
    badge: "Nâng cấp kỹ năng vibe coding",
    hero: {
      h1a: "Học vibe coding",
      h1b: "cùng thú cưng AI của bạn",
      sub: "DevPet là trợ lý AI theo dõi phiên code của bạn, dạy bạn các phương pháp tốt nhất, và giúp bạn từ prompt đầu tiên đến sản phẩm hoàn chỉnh — tất cả được hướng dẫn bởi một thú cưng mentor.",
    },
    waitlist: {
      placeholder: "Email của bạn",
      btn: "Đăng ký ngay →",
      count: "người đã đăng ký",
      success: "Bạn đã trong danh sách!",
      successSub: "Chúng tôi sẽ liên hệ khi DevPet sẵn sàng.",
    },
    problem: {
      label: "Vấn đề",
      h2a: "Ai cũng đang vibe coding.",
      h2b: "Nhưng chẳng ai dạy cách làm tốt.",
      items: [
        { emoji: "😰", title: "Mắc kẹt trong vòng lặp", body: "Bạn prompt, gặp lỗi, sửa lại, lại lỗi khác, lặp lại. 20 phút trôi qua." },
        { emoji: "🤷", title: "Không có nền tảng dự án", body: "Không rules file, không README, không design system. AI đoán mò mỗi lần." },
        { emoji: "📈", title: "Không đo được tiến bộ", body: "Bạn không biết mình có giỏi hơn không. Mỗi phiên code như bắt đầu lại từ đầu." },
      ],
    },
    features: {
      label: "Tính năng",
      h2a: "Bạn đồng hành coding",
      h2b: "giúp bạn thực sự giỏi hơn",
      items: [
        { icon: "📖", title: "Kể chuyện phiên code", body: "Mỗi phiên code thành câu chuyện với bài học, mẹo, và cột mốc — không phải nhật ký, mà là trải nghiệm học.", tag: "Trực tiếp" },
        { icon: "🌳", title: "Cây kỹ năng", body: "16 kỹ năng qua 4 cấp độ — từ Prompt rõ ràng đến Kiến trúc AI. Lên level bằng cách code thực.", tag: "Học" },
        { icon: "🔍", title: "Phân tích sức khỏe dự án", body: "DevPet quét tìm docs thiếu, rules file, thiết kế không đồng nhất, và cấu trúc lộn xộn.", tag: "Phân tích" },
        { icon: "😺", title: "Chat với thú cưng", body: "Nhấn vào thú cưng bất cứ lúc nào để hỏi. Nó biết dự án, lịch sử, và trình độ của bạn.", tag: "Hướng dẫn" },
        { icon: "📊", title: "Báo cáo tuần", body: "Báo cáo AI về sự phát triển với bài học, mẫu lỗi, chi phí, và gợi ý cụ thể.", tag: "Phản ánh" },
        { icon: "🎯", title: "Tự động phát hiện", body: "Không cần bấm nút. DevPet tự phát hiện khi bạn mở Cursor, VS Code, hay công cụ AI.", tag: "Tự động" },
      ],
    },
    how: {
      label: "Cách hoạt động",
      h2a: "Ba bước để",
      h2b: "vibe coding tốt hơn",
      steps: [
        { step: "01", title: "Cài đặt & code", body: "Tải DevPet. Mở công cụ AI yêu thích. Xong — DevPet bắt đầu theo dõi và học pattern của bạn tự động.", icon: "⚡" },
        { step: "02", title: "Học khi xây dựng", body: "Nhận mẹo real-time khi bị kẹt, ăn mừng cột mốc, và nhận giải thích dễ hiểu về lỗi.", icon: "🐾" },
        { step: "03", title: "Phát triển theo thời gian", body: "Xem lại bản tóm tắt hàng ngày, theo dõi tiến bộ kỹ năng, và xem tỷ lệ lỗi giảm mỗi tuần.", icon: "📈" },
      ],
    },
    social: {
      stats: [
        { value: "847+", label: "Đăng ký" },
        { value: "16", label: "Kỹ năng" },
        { value: "4", label: "Cấp độ" },
        { value: "∞", label: "Sự kiên nhẫn" },
      ],
      quote: "Tôi từ chỗ bị kẹt 20 phút với mỗi lỗi CSS xuống còn dưới 3 phút. DevPet không chỉ dạy tôi prompting — nó dạy tôi cách nghĩ về AI như một công cụ.",
      author: "Người dùng thử nghiệm",
    },
    audience: {
      label: "Dành cho ai",
      h2a: "Dù bạn đang viết prompt đầu tiên",
      h2b: "hay đang ship ứng dụng thứ mười",
      items: [
        { who: "Người mới hoàn toàn", desc: "Chưa bao giờ vibe code? DevPet hướng dẫn bạn dự án đầu tiên trong 10 phút.", icon: "🌱" },
        { who: "Builder cá nhân", desc: "Xây dựng side project với AI? Học cách setup dự án để AI tools hoạt động tốt hơn 10×.", icon: "🛠️" },
        { who: "Kỹ sư tương lai", desc: "Muốn kỹ năng AI-native engineering? DevPet dạy meta-skills giúp phát triển vượt bậc.", icon: "🚀" },
      ],
    },
    cta: {
      h2a: "Sẵn sàng nâng cấp",
      h2b: "vibe coding?",
      sub: "người khác đang chờ DevPet. Chúng tôi sẽ thông báo khi sẵn sàng.",
      success: "Chào mừng bạn!",
      successSub: "Thú cưng của bạn sẽ đợi bạn.",
    },
    footer: {
      tagline: "Nâng cấp vibe coding · Sắp ra mắt",
      copy: "© 2026 DevPet. Built with vibes.",
    },
  },
};
