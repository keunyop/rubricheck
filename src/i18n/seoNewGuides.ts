import type { SeoLandingPageContent } from "../config/seoPages";
import { HOME_INTERNAL_LINKS } from "../config/seoPages";
import guideDetails from "./seoGuideDetails.json";

type NewLocale = "hi" | "ur" | "vi" | "zh";
type GuideTexts = {
  pages: Record<string, [string, string]>;
  eyebrow: string; sections: [string, string][];
  faq: [string, string][];
  exampleTitle: string; exampleDescription: string; columns: [string, string, string]; rows: [string, string, string][]; note: string; cta: string;
};
const copy: Record<NewLocale, GuideTexts> = {
  hi: {
    pages: {
      "rubric-checker": ["रूब्रिक के आधार पर अपना ड्राफ्ट कैसे जाँचें", "मूल्यांकन मानदंड पढ़ें, अपने ड्राफ्ट में प्रमाण खोजें और फीडबैक से सुधार की योजना बनाएँ।"],
      "ai-rubric-grader": ["AI रूब्रिक मूल्यांकन: अनुमानित अंक और फीडबैक", "जानें कि AI आपके रूब्रिक के आधार पर अनुमान और सुधार के सुझाव कैसे देता है और उनकी सीमाएँ क्या हैं।"],
      "assignment-rubric-checker": ["रूब्रिक से असाइनमेंट की जाँच करें", "रिपोर्ट, प्रोजेक्ट या चिंतनात्मक असाइनमेंट को जमा करने से पहले मानदंड और आवश्यकताओं से मिलाएँ।"],
      "essay-rubric-checker": ["रूब्रिक से निबंध की जाँच करें", "निबंध की मुख्य दलील, प्रमाण, विश्लेषण और संरचना को अपने मूल्यांकन मानदंड से मिलाएँ।"],
      "rubric-feedback-tool": ["रूब्रिक फीडबैक से सुधार की योजना बनाएँ", "मानदंड के अनुसार फीडबैक पढ़ें और अपने ड्राफ्ट में सबसे ज़रूरी बदलाव तय करें।"],
      "how-to-use-a-rubric-to-check-an-assignment": ["असाइनमेंट जाँचने के लिए रूब्रिक का उपयोग कैसे करें", "रूब्रिक पढ़ने, ड्राफ्ट में प्रमाण खोजने और सुधार को प्राथमिकता देने के आसान चरण देखें।"],
    },
    faq: [["RubriCheck क्या करता है?", "RubriCheck आपके निबंध या असाइनमेंट के ड्राफ्ट को दिए गए रूब्रिक से मिलाता है, अनुमानित अंक बताता है और सुधार के मुख्य सुझाव देता है।"], ["क्या यह आधिकारिक अंक देता है?", "नहीं। AI से मिले अंक अनुमान हैं। आधिकारिक अंक शिक्षक तय करते हैं; फीडबैक को मूल रूब्रिक से जाँचें।"]],
    eyebrow: "जमा करने से पहले जाँच", sections: [
      ["पूरा रूब्रिक पढ़ें", "हर मानदंड, अंक और प्रदर्शन स्तर देखें। असाइनमेंट के निर्देश भी जोड़ें ताकि आवश्यकताएँ स्पष्ट रहें।"],
      ["ड्राफ्ट में प्रमाण खोजें", "हर मानदंड से संबंधित अंश चिह्नित करें। जाँचें कि मुख्य दलील को पर्याप्त प्रमाण और स्पष्ट विश्लेषण मिलता है।"],
      ["फीडबैक से सुधार करें", "पहले सबसे महत्वपूर्ण कमियाँ सुधारें। AI के अनुमान आधिकारिक अंक नहीं हैं; मूल रूब्रिक और शिक्षक के निर्देशों से परिणाम की जाँच करें।"],
    ],
    exampleTitle: "ड्राफ्ट जाँच का उदाहरण", exampleDescription: "मानदंड को स्पष्ट सुधार कार्य में बदलें।", columns: ["मानदंड", "जाँच", "अगला कदम"], rows: [["प्रमाण", "दावे के लिए पर्याप्त स्रोत नहीं हैं", "विश्वसनीय स्रोत जोड़ें और संबंध समझाएँ"], ["संरचना", "अनुच्छेदों का क्रम अस्पष्ट है", "विचारों को तार्किक क्रम में रखें"]], note: "यह केवल उदाहरण है, आधिकारिक अंक या सुधार की गारंटी नहीं।", cta: "अपना असाइनमेंट जाँचें",
  },
  ur: {
    pages: {
      "rubric-checker": ["روبریک کی مدد سے اپنا مسودہ کیسے جانچیں", "جانچ کے معیار پڑھیں، مسودے میں شواہد تلاش کریں اور فیڈبیک سے بہتری کا منصوبہ بنائیں۔"],
      "ai-rubric-grader": ["AI روبریک جانچ: متوقع نمبر اور فیڈبیک", "جانیں کہ AI آپ کے روبریک کی بنیاد پر اندازے اور بہتری کی تجاویز کیسے دیتا ہے اور ان کی حدود کیا ہیں۔"],
      "assignment-rubric-checker": ["روبریک سے اسائنمنٹ کی جانچ", "رپورٹ، پروجیکٹ یا عکاسی پر مبنی اسائنمنٹ کو جمع کرانے سے پہلے معیار اور ہدایات سے ملائیں۔"],
      "essay-rubric-checker": ["روبریک سے مضمون کی جانچ", "اپنے مضمون کے مرکزی مؤقف، شواہد، تجزیے اور ترتیب کو جانچ کے معیار سے ملائیں۔"],
      "rubric-feedback-tool": ["روبریک فیڈبیک سے بہتری کا منصوبہ بنائیں", "ہر معیار کا فیڈبیک پڑھیں اور مسودے میں ضروری تبدیلیوں کی ترجیح طے کریں۔"],
      "how-to-use-a-rubric-to-check-an-assignment": ["اسائنمنٹ جانچنے کے لیے روبریک کیسے استعمال کریں", "روبریک پڑھنے، مسودے میں شواہد ڈھونڈنے اور تبدیلیوں کی ترجیح طے کرنے کے مراحل دیکھیں۔"],
    },
    faq: [["RubriCheck کیا کرتا ہے؟", "RubriCheck آپ کے مضمون یا اسائنمنٹ کے مسودے کو فراہم کردہ روبریک سے ملا کر متوقع نمبر اور بہتری کی اہم تجاویز دیتا ہے۔"], ["کیا یہ سرکاری نمبر دیتا ہے؟", "نہیں۔ AI کے نمبر صرف اندازے ہیں۔ سرکاری نمبر استاد طے کرتے ہیں؛ فیڈبیک کو اصل روبریک سے جانچیں۔"]],
    eyebrow: "جمع کرانے سے پہلے جانچ", sections: [
      ["پورا روبریک پڑھیں", "ہر معیار، نمبر اور کارکردگی کی سطح دیکھیں۔ اسائنمنٹ کی ہدایات بھی شامل کریں تاکہ ضروریات واضح رہیں۔"],
      ["مسودے میں شواہد تلاش کریں", "ہر معیار سے متعلق حصے نشان زد کریں۔ دیکھیں کہ مرکزی مؤقف کے لیے کافی شواہد اور واضح تجزیہ موجود ہے۔"],
      ["فیڈبیک کی مدد سے بہتری لائیں", "پہلے اہم خامیاں درست کریں۔ AI کے اندازے سرکاری نمبر نہیں ہیں؛ نتیجے کو اصل روبریک اور استاد کی ہدایات سے جانچیں۔"],
    ],
    exampleTitle: "مسودہ جانچنے کی مثال", exampleDescription: "معیار کو واضح اصلاحی قدم میں تبدیل کریں۔", columns: ["معیار", "جانچ", "اگلا قدم"], rows: [["شواہد", "دعوے کے لیے کافی ذرائع نہیں", "معتبر ماخذ شامل کریں اور تعلق واضح کریں"], ["ترتیب", "پیراگراف کی ترتیب واضح نہیں", "خیالات کو منطقی ترتیب میں رکھیں"]], note: "یہ صرف ایک مثال ہے، سرکاری نمبر یا بہتری کی ضمانت نہیں۔", cta: "اپنا اسائنمنٹ جانچیں",
  },
  vi: {
    pages: {
      "rubric-checker": ["Cách kiểm tra bản nháp theo rubric", "Đọc tiêu chí đánh giá, tìm minh chứng trong bản nháp và lập kế hoạch chỉnh sửa từ phản hồi."],
      "ai-rubric-grader": ["Chấm bài theo rubric bằng AI: điểm ước tính và phản hồi", "Tìm hiểu cách AI đưa ra điểm ước tính và gợi ý cải thiện theo rubric, cùng những giới hạn của kết quả."],
      "assignment-rubric-checker": ["Kiểm tra bài tập theo rubric", "Đối chiếu báo cáo, dự án hoặc bài phản tư với tiêu chí và yêu cầu trước khi nộp."],
      "essay-rubric-checker": ["Kiểm tra bài luận theo rubric", "Đối chiếu luận điểm, dẫn chứng, phân tích và bố cục bài luận với tiêu chí đánh giá."],
      "rubric-feedback-tool": ["Biến phản hồi rubric thành kế hoạch chỉnh sửa", "Đọc phản hồi theo từng tiêu chí và xác định những thay đổi cần ưu tiên trong bản nháp."],
      "how-to-use-a-rubric-to-check-an-assignment": ["Cách dùng rubric để tự kiểm tra bài tập", "Xem các bước đọc rubric, tìm minh chứng trong bản nháp và ưu tiên chỉnh sửa."],
    },
    faq: [["RubriCheck làm gì?", "RubriCheck đối chiếu bản nháp bài luận hoặc bài tập với rubric bạn cung cấp, ước tính điểm và nêu những điểm cần ưu tiên chỉnh sửa."], ["Đây có phải là điểm chính thức không?", "Không. Điểm do AI đưa ra chỉ là ước tính. Giảng viên quyết định điểm chính thức; hãy đối chiếu phản hồi với rubric gốc."]],
    eyebrow: "Hướng dẫn kiểm tra trước khi nộp", sections: [
      ["Đọc toàn bộ rubric", "Xem từng tiêu chí, số điểm và mức độ đạt được. Thêm hướng dẫn bài tập để làm rõ các yêu cầu."],
      ["Tìm minh chứng trong bản nháp", "Đánh dấu các đoạn liên quan đến từng tiêu chí. Kiểm tra xem luận điểm có đủ dẫn chứng và phân tích rõ ràng hay không."],
      ["Chỉnh sửa dựa trên phản hồi", "Ưu tiên sửa những thiếu sót quan trọng. Điểm AI chỉ là ước tính; hãy đối chiếu kết quả với rubric gốc và hướng dẫn của giảng viên."],
    ],
    exampleTitle: "Ví dụ kiểm tra bản nháp", exampleDescription: "Chuyển tiêu chí thành hành động chỉnh sửa cụ thể.", columns: ["Tiêu chí", "Điều cần kiểm tra", "Bước tiếp theo"], rows: [["Dẫn chứng", "Chưa đủ nguồn hỗ trợ luận điểm", "Thêm nguồn đáng tin cậy và giải thích mối liên hệ"], ["Bố cục", "Thứ tự các đoạn chưa rõ ràng", "Sắp xếp ý theo trình tự logic"]], note: "Đây chỉ là ví dụ, không phải điểm chính thức hay cam kết tăng điểm.", cta: "Kiểm tra bài tập của tôi",
  },
  zh: {
    pages: {
      "rubric-checker": ["如何根据评分标准检查初稿", "阅读评分项目，在初稿中查找依据，并根据反馈制定修改计划。"],
      "ai-rubric-grader": ["AI 评分标准检查：预估分数与反馈", "了解 AI 如何根据评分标准提供分数预估和修改建议，以及结果的局限。"],
      "assignment-rubric-checker": ["根据评分标准检查作业", "提交前将报告、项目或反思作业与评分项目及要求逐一对照。"],
      "essay-rubric-checker": ["根据评分标准检查论文", "对照评分标准检查论文的论点、论据、分析和结构。"],
      "rubric-feedback-tool": ["将评分反馈转化为修改计划", "阅读各评分项目的反馈，确定初稿中需要优先修改的内容。"],
      "how-to-use-a-rubric-to-check-an-assignment": ["如何使用评分标准自查作业", "了解阅读评分标准、在初稿中查找依据以及确定修改重点的步骤。"],
    },
    faq: [["RubriCheck 有什么功能？", "RubriCheck 将你的论文或作业初稿与提供的评分标准进行对照，给出预估分数和优先修改建议。"], ["这是正式成绩吗？", "不是。AI 给出的分数只是预估，正式成绩由教师决定。请结合原始评分标准核对反馈。"]],
    eyebrow: "提交前检查指南", sections: [
      ["阅读完整的评分标准", "查看每项评分要求、分值和表现等级。加入作业说明，让具体要求更加清晰。"],
      ["在初稿中查找依据", "标记与各评分项目相关的段落，检查主要论点是否有充分的论据和清晰的分析。"],
      ["根据反馈修改", "先处理最重要的不足。AI 分数只是预估，请结合原始评分标准和教师要求核对结果。"],
    ],
    exampleTitle: "初稿检查示例", exampleDescription: "将评分要求转化为具体的修改行动。", columns: ["评分项目", "检查内容", "下一步"], rows: [["论据", "支持论点的资料不足", "补充可靠来源并说明其关联"], ["结构", "段落顺序不够清晰", "按照逻辑顺序调整观点"]], note: "此示例仅供说明，并非正式成绩或分数提升保证。", cta: "检查我的作业",
  },
};
export function localizeNewSeoGuide(page: SeoLandingPageContent, locale: NewLocale): SeoLandingPageContent {
  const c = copy[locale];
  const [title, description] = c.pages[page.slug];
  const details = (guideDetails as unknown as Record<NewLocale, Record<string, Pick<SeoLandingPageContent, "sections" | "example">>>)[locale][page.slug];
  return { ...page, title, h1: title, description, intro: description, eyebrow: c.eyebrow,
    keywords: [title], sections: details.sections, example: details.example,
    faqItems: c.faq.map(([question, answer]) => ({ question, answer })),
    relatedLinks: HOME_INTERNAL_LINKS.filter(link => link.href !== page.path).map(link => ({ ...link, label: c.pages[link.href.slice(1)][0], description: c.pages[link.href.slice(1)][1] })), ctaLabel: c.cta };
}
