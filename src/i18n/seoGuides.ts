import { localizeNewSeoGuide } from "./seoNewGuides";
import type { SeoLandingPageContent } from "../config/seoPages";
import { HOME_FAQ_ITEMS, HOME_INTERNAL_LINKS } from "../config/seoPages";
import { translate } from "./translate";
import type { Locale } from "./config";

type GuideCopy = { title: string; description: string; intro: string; sections: [string, string][]; example: [string, string, string][] };
const guides: Record<"ko" | "ms", Record<string, GuideCopy>> = {
  ko: {
    "rubric-checker": {
      title: "채점 기준표로 과제를 점검하는 방법",
      description: "루브릭의 평가 항목과 배점을 이해하고 과제 초안을 점검하는 방법을 알아보세요. 기준표 준비부터 피드백을 반영한 수정까지 예시로 안내합니다.",
      intro: "과제를 제출하기 전, 채점 기준표에 적힌 요구사항이 초안에 충분히 드러나는지 확인해 보세요. RubriCheck는 제공한 기준표에 따라 초안을 검토하고 예상 점수 범위와 우선 개선 사항을 알려드립니다.",
      sections: [
        ["평가의 출발점은 채점 기준표입니다", "기준표가 근거, 구성, 성찰에 점수를 부여한다면 초안에서도 이 세 항목을 살펴봐야 합니다. 자료 개수나 필수 목차처럼 명시되지 않은 요구사항을 도구가 추측할 수는 없습니다. 기준표에 있는 모든 행, 배점, 성취 수준 설명을 포함하세요."],
        ["기준표와 과제를 각각 입력하세요", "PDF, DOCX, TXT, 이미지 파일을 올리거나 텍스트를 붙여넣을 수 있습니다. 이미지의 글자는 선명해야 하며 표가 잘리면 안 됩니다. 기준표가 없으면 일반 평가 기준을 사용하고 과제 안내를 추가할 수 있습니다."],
        ["점수보다 구체적인 수정 방향에 주목하세요", "각 항목의 피드백을 원래 기준표와 비교하세요. 빠진 근거, 불명확한 설명, 구성 문제를 먼저 수정한 뒤 같은 기준표와 채점 모드로 다시 확인하면 변화의 의미를 파악하기 쉽습니다. 예상 점수는 공식 성적이 아닙니다."],
      ],
      example: [["근거", "주장을 뒷받침하는 자료가 필요함", "인용한 자료와 주장 사이의 관계를 설명하기"], ["구성", "문단 사이의 흐름이 끊김", "각 문단의 목적을 확인하고 연결 문장 추가하기"], ["성찰", "경험을 나열하는 데 그침", "경험에서 배운 점과 다음 행동을 구체화하기"]],
    },
    "ai-rubric-grader": {
      title: "AI 루브릭 채점으로 예상 점수와 피드백 확인하기",
      description: "AI 채점이 기준표를 사용하는 방식, 표준·엄격 모드의 차이, 예상 점수의 한계를 알아보세요. 제출 전 과제 검토에 활용할 수 있습니다.",
      intro: "AI 루브릭 채점은 과제의 어느 부분이 평가 기준을 충족하는지 살펴보는 보조 도구입니다. RubriCheck는 교강사를 대신해 최종 성적을 결정하지 않으며, 초안을 개선할 수 있는 근거와 방향을 제공합니다.",
      sections: [
        ["평가 항목별 결과를 확인하세요", "기준표의 항목과 배점을 바탕으로 예상 점수 범위와 피드백을 제시합니다. 전체 점수 범위는 항목별 범위의 합계를 기준표 총점으로 나눈 뒤 100점 기준으로 환산합니다. 결과의 설명이 실제 과제 내용과 맞는지도 직접 확인하세요."],
        ["같은 모드로 비교하세요", "표준 모드는 일반적인 기준 검토에 적합합니다. 엄격 모드는 근거가 부족하거나 요구사항이 빠진 부분을 더 보수적으로 평가합니다. 모드 변경으로 생긴 점수 차이를 수정 효과로 해석하면 안 됩니다. 엄격 모드는 크레딧 또는 Pro로 이용할 수 있습니다."],
        ["예상 범위를 성적 보장으로 해석하지 마세요", "AI의 판단에는 오류와 편차가 있을 수 있습니다. 표시된 범위는 통계적으로 검증된 신뢰구간이 아닙니다. 담당 교강사가 기대하는 수업 맥락, 별도 안내, 실제 제출 조건까지 함께 확인해야 합니다."],
      ],
      example: [["주장 · 40점", "예상 범위 28–33점", "핵심 주장은 명확하지만 범위를 더 좁힐 수 있음"], ["근거 · 40점", "예상 범위 25–30점", "신뢰할 수 있는 자료와 해석 보강이 필요함"], ["구성 · 20점", "예상 범위 17–20점", "문단 흐름은 자연스러우며 결론을 다듬을 수 있음"]],
    },
    "assignment-rubric-checker": {
      title: "보고서와 프로젝트 과제, 제출 전에 점검하세요",
      description: "보고서·프로젝트·성찰 과제의 요구사항을 채점 기준표에 맞춰 확인하세요. 빠진 내용과 근거, 구조를 점검하는 실용적인 방법을 안내합니다.",
      intro: "과제마다 필요한 결과물과 평가 기준은 다릅니다. 보고서, 프로젝트 문서, 성찰 과제에 맞는 실제 기준표를 사용하면 일반적인 글쓰기 조언보다 과제에 필요한 수정 사항을 찾기 쉽습니다.",
      sections: [
        ["제출물 전체를 준비하세요", "필수 목차, 분량, 자료 수, 분석 방법이 평가 항목에 어떻게 반영되는지 확인하세요. 보고서의 일부만 올리면 빠진 페이지의 내용을 평가할 수 없습니다. 표나 이미지 안의 핵심 정보도 읽을 수 있는 상태로 준비하세요."],
        ["내용의 존재와 설명의 충분함을 구분하세요", "제목만 있는 방법론 절과 실제 절차를 설명한 절은 다릅니다. 요구된 부분이 있는지 확인한 뒤 기준표의 성취 수준에 맞게 설명과 근거가 충분한지 살펴보세요."],
        ["프로젝트에서 초안의 변화를 추적하세요", "여러 번 수정하는 과제라면 프로젝트에 버전별 결과를 모아두세요. 같은 기준표와 같은 모드로 비교하고, 수정한 부분이 피드백에 어떻게 반영되었는지 확인하세요. 실제 성적이 나오면 별도로 기록할 수도 있습니다."],
      ],
      example: [["보고서", "결과는 있지만 해석이 부족함", "결과가 연구 질문에 어떤 답을 주는지 설명하기"], ["프로젝트", "결과물만 있고 과정이 빠짐", "주요 선택의 이유와 검증 과정을 추가하기"], ["성찰 과제", "활동 요약에 머무름", "배운 점, 한계, 다음 시도를 구체적으로 적기"]],
    },
    "essay-rubric-checker": {
      title: "에세이의 주장·근거·구성을 채점 기준에 맞춰 검토하세요",
      description: "에세이 초안을 루브릭에 맞춰 점검하고 주장, 근거, 분석, 문단 구성의 개선점을 찾으세요. 제출 전 수정 우선순위를 정하는 데 도움이 됩니다.",
      intro: "좋은 에세이는 문법이 자연스러운 것만으로 완성되지 않습니다. 과제 질문에 답하는 주장, 이를 뒷받침하는 근거, 근거를 해석하는 분석이 평가 기준에 맞게 드러나는지 확인하세요.",
      sections: [
        ["핵심 주장이 과제 질문에 답하는지 확인하세요", "서론에서 다루는 범위와 입장이 분명해야 합니다. 주제가 넓기만 한 문장이라면 무엇을, 왜 주장하는지 좁혀 보세요. 본문의 각 문단도 그 주장을 발전시키는 역할을 해야 합니다."],
        ["인용 뒤에 자신의 분석을 더하세요", "자료를 많이 인용해도 주장을 어떻게 뒷받침하는지 설명하지 않으면 설득력이 부족할 수 있습니다. 자료의 신뢰성, 관련성, 인용 정확성을 확인하고 근거와 주장 사이의 연결을 직접 설명하세요."],
        ["문단 순서와 반론을 점검하세요", "문단별 핵심 내용을 한 줄씩 정리하면 논리의 빈틈을 찾기 쉽습니다. 기준표에서 요구한다면 주요 반론도 공정하게 다루세요. 피드백을 반영하되 인용과 사실은 직접 검증하고 학교의 AI 이용 규정을 따르세요."],
      ],
      example: [["주장", "‘등교 시간이 중요하다’는 넓은 표현", "등교 시간을 늦춰야 하는 이유를 구체적으로 밝히기"], ["근거", "학급 친구의 경험에만 의존함", "수면과 학습에 관한 신뢰할 수 있는 자료 추가하기"], ["분석", "자료 인용 뒤 설명이 없음", "자료가 주장과 어떤 관계인지 설명하기"]],
    },
    "rubric-feedback-tool": {
      title: "채점 피드백을 구체적인 수정 계획으로 바꾸세요",
      description: "평가 항목별 피드백을 읽고 개선 우선순위를 정하는 방법을 안내합니다. 근거 보강, 설명 구체화, 구성 개선을 다음 초안에 반영해 보세요.",
      intro: "피드백은 읽는 데서 끝나지 않고 다음 초안을 바꿀 때 도움이 됩니다. RubriCheck의 항목별 설명과 우선 개선 사항을 활용해 무엇을, 어디에, 어떻게 수정할지 계획해 보세요.",
      sections: [
        ["평가 기준과 연결해서 읽으세요", "‘근거가 부족하다’는 피드백이 어떤 주장이나 문단에 해당하는지 확인하세요. 원래 기준표의 표현과 과제 속 근거를 함께 읽으면 피드백이 타당한지 판단할 수 있습니다."],
        ["영향이 큰 문제부터 수정하세요", "배점이 큰 항목에서 빠진 내용이나 핵심 논리의 빈틈을 먼저 해결하세요. 그다음 문단 구성, 표현, 형식을 다듬으면 수정 시간을 효율적으로 사용할 수 있습니다. 모든 제안을 그대로 따를 필요는 없습니다."],
        ["수정 전후의 근거를 비교하세요", "다시 채점할 때는 같은 기준표와 모드를 사용하세요. 점수가 올랐는지만 보지 말고 추가한 근거와 설명이 피드백에 반영되었는지도 확인하세요. Pro의 문장 수정 제안은 참고 예시이며 검토와 편집이 필요합니다."],
      ],
      example: [["근거가 부족함", "해당 주장과 자료를 다시 확인", "신뢰할 수 있는 자료를 추가하고 연결 관계 설명"], ["구성이 불명확함", "문단별 목적을 한 줄로 정리", "논리 순서에 맞게 이동하고 연결 문장 보강"], ["설명이 추상적임", "독자가 이해하기 어려운 표현 표시", "구체적인 사례나 과정으로 풀어서 쓰기"]],
    },
    "how-to-use-a-rubric-to-check-an-assignment": {
      title: "채점 기준표로 내 과제를 스스로 점검하는 순서",
      description: "루브릭을 읽고, 초안의 근거를 찾고, 수정 우선순위를 정하는 과정을 따라 해보세요. AI 피드백과 함께 사용할 수 있는 과제 자기 점검 가이드입니다.",
      intro: "채점 기준표는 성적을 매기는 표이면서 과제를 준비하는 체크리스트이기도 합니다. 제출 직전 점수만 예상하기보다 초안 단계부터 기준표를 활용하면 빠진 요구사항을 일찍 발견할 수 있습니다.",
      sections: [
        ["1. 평가 항목과 성취 수준을 읽으세요", "각 항목의 배점과 높은 수준의 설명을 확인하세요. 추상적인 표현은 실제 행동으로 바꿔 적어보세요. ‘분석의 깊이’라면 단순 요약을 넘어 원인, 의미, 한계를 설명하는지 점검할 수 있습니다."],
        ["2. 초안에서 해당 근거를 찾으세요", "각 기준을 충족한다고 생각하는 문장이나 문단에 표시하세요. 근거를 찾을 수 없다면 빠졌거나 충분히 드러나지 않은 부분일 수 있습니다. 자신이 의도한 내용과 실제로 쓴 내용을 구분하는 것이 중요합니다."],
        ["3. 수정하고 같은 조건으로 다시 확인하세요", "빠진 핵심 요구사항부터 보완하고 수정 내용을 기록하세요. 필요하면 RubriCheck의 AI 피드백과 비교하되 원래 기준표와 교강사 안내를 우선하세요. 제출본과 AI 검토본이 같은 버전인지도 확인해 두세요."],
      ],
      example: [["기준 읽기", "‘신뢰할 수 있는 근거를 사용한다’", "어떤 자료가 적합한지 과제 안내와 함께 확인"], ["근거 찾기", "본문에 개인 경험만 있음", "외부 자료가 필요한 부분을 표시"], ["수정 확인", "자료와 해석을 보강함", "같은 기준표로 근거의 적절성을 다시 점검"]],
    },
  },
  ms: {
    "rubric-checker": {
      title: "Cara Menyemak Draf Berdasarkan Rubrik",
      description: "Fahami kriteria dan pemberatan rubrik, sediakan draf anda dan gunakan maklum balas untuk membuat pembaikan. Panduan ini disertakan contoh semakan tugasan.",
      intro: "Sebelum menghantar tugasan, semak sama ada draf anda memenuhi kehendak rubrik. RubriCheck menilai draf berdasarkan rubrik yang diberikan dan mencadangkan perkara utama untuk diperbaiki bersama julat anggaran markah.",
      sections: [
        ["Rubrik menentukan skop semakan", "Jika rubrik memperuntukkan markah untuk bukti, susunan dan refleksi, semak ketiga-tiganya dalam draf anda. Alat ini tidak boleh meneka syarat yang tidak dinyatakan, seperti bilangan sumber atau bahagian wajib. Sertakan semua baris, markah dan huraian tahap pencapaian."],
        ["Masukkan rubrik dan tugasan secara berasingan", "Muat naik PDF, DOCX, TXT atau imej, atau tampal teks. Pastikan teks dalam imej jelas dan jadual tidak terpotong. Jika tiada rubrik, gunakan kriteria umum dan tambahkan arahan tugasan jika ada."],
        ["Utamakan pembaikan yang khusus", "Bandingkan maklum balas setiap kriteria dengan rubrik asal. Baiki bukti yang kurang, penjelasan kabur dan masalah susunan terlebih dahulu. Gunakan rubrik dan mod yang sama untuk menyemak semula. Anggaran markah bukan markah rasmi."],
      ],
      example: [["Bukti", "Hujah memerlukan sokongan sumber", "Terangkan hubungan antara sumber dengan hujah"], ["Susunan", "Peralihan antara perenggan terputus", "Semak tujuan perenggan dan tambah ayat penghubung"], ["Refleksi", "Hanya menyenaraikan pengalaman", "Jelaskan pembelajaran dan tindakan seterusnya"]],
    },
    "ai-rubric-grader": {
      title: "Penilaian Rubrik AI: Anggaran Markah dan Maklum Balas",
      description: "Ketahui cara penilaian AI menggunakan rubrik, perbezaan mod standard dan mod ketat serta batasan anggaran markah sebelum menghantar tugasan.",
      intro: "Penilaian rubrik AI membantu anda mengenal pasti bahagian tugasan yang memenuhi kriteria. RubriCheck tidak menggantikan pengajar dalam menentukan markah akhir; ia menyediakan maklum balas untuk membantu anda memperbaiki draf.",
      sections: [
        ["Semak hasil mengikut kriteria", "Julat anggaran markah dan maklum balas berpandukan kriteria serta markah dalam rubrik. Julat keseluruhan dikira dengan menjumlahkan julat setiap kriteria, membahagikannya dengan jumlah markah rubrik dan menukarkannya kepada skala 100. Semak sendiri sama ada penjelasannya sepadan dengan tugasan."],
        ["Bandingkan menggunakan mod yang sama", "Mod standard sesuai untuk semakan biasa. Mod ketat menilai secara lebih konservatif apabila bukti lemah atau syarat tidak dipenuhi. Perubahan markah akibat pertukaran mod bukan bukti bahawa draf bertambah baik. Mod ketat tersedia dengan kredit atau Pro."],
        ["Anggaran bukan jaminan markah", "Penilaian AI boleh mengandungi ralat dan variasi. Julat yang dipaparkan bukan selang keyakinan yang disahkan secara statistik. Ambil kira konteks kursus, arahan tambahan pengajar dan syarat penghantaran sebenar."],
      ],
      example: [["Hujah · 40 markah", "Julat anggaran 28–33", "Pendirian jelas tetapi skop boleh diperincikan"], ["Bukti · 40 markah", "Julat anggaran 25–30", "Perlu sumber yang boleh dipercayai dan huraian lanjut"], ["Susunan · 20 markah", "Julat anggaran 17–20", "Aliran perenggan baik; kesimpulan boleh diperhalus"]],
    },
    "assignment-rubric-checker": {
      title: "Semak Laporan dan Tugasan Projek Sebelum Menghantar",
      description: "Semak keperluan laporan, projek dan tugasan refleksi berdasarkan rubrik. Kenal pasti kandungan yang kurang, bukti lemah dan masalah susunan.",
      intro: "Setiap tugasan mempunyai hasil dan kriteria penilaian tersendiri. Gunakan rubrik sebenar untuk laporan, dokumen projek atau refleksi supaya maklum balas lebih berkaitan dengan keperluan tugasan anda.",
      sections: [
        ["Sediakan tugasan yang lengkap", "Semak bagaimana bahagian wajib, panjang tugasan, bilangan sumber dan kaedah analisis dinilai. Jika hanya sebahagian laporan dimuat naik, kandungan halaman yang tidak disertakan tidak boleh dinilai. Pastikan maklumat utama dalam jadual dan imej boleh dibaca."],
        ["Bezakan kewujudan kandungan dengan kecukupan penjelasan", "Bahagian metodologi yang hanya mempunyai tajuk tidak sama dengan bahagian yang menerangkan prosedur sebenar. Selepas memastikan setiap bahagian ada, semak sama ada penjelasan dan bukti memenuhi tahap pencapaian rubrik."],
        ["Jejak perubahan melalui projek", "Kumpulkan hasil setiap versi dalam projek apabila tugasan disemak berulang kali. Gunakan rubrik dan mod yang sama, kemudian lihat bagaimana pembaikan tercermin dalam maklum balas. Anda juga boleh merekodkan markah sebenar selepas diterima."],
      ],
      example: [["Laporan", "Hasil ada tetapi tafsiran kurang", "Terangkan bagaimana hasil menjawab soalan kajian"], ["Projek", "Hanya hasil akhir, tanpa proses", "Tambahkan alasan keputusan dan proses pengesahan"], ["Refleksi", "Terhad kepada ringkasan aktiviti", "Nyatakan pembelajaran, batasan dan langkah seterusnya"]],
    },
    "essay-rubric-checker": {
      title: "Semak Hujah, Bukti dan Susunan Esei Berdasarkan Rubrik",
      description: "Semak draf esei berdasarkan rubrik dan cari ruang penambahbaikan dalam hujah, bukti, analisis dan susunan perenggan sebelum penghantaran.",
      intro: "Esei yang baik memerlukan lebih daripada tatabahasa yang lancar. Pastikan hujah menjawab soalan tugasan, disokong bukti dan dihuraikan melalui analisis yang memenuhi kriteria penilaian.",
      sections: [
        ["Pastikan hujah menjawab soalan", "Nyatakan skop dan pendirian dengan jelas dalam pengenalan. Jika pernyataan terlalu umum, perincikan perkara yang dihujahkan dan sebabnya. Setiap perenggan isi perlu membantu mengembangkan hujah tersebut."],
        ["Tambahkan analisis selepas petikan", "Banyak petikan tidak semestinya menguatkan esei jika kaitannya dengan hujah tidak diterangkan. Semak kebolehpercayaan sumber, kaitannya dan ketepatan petikan. Jelaskan sendiri bagaimana bukti menyokong pendirian anda."],
        ["Semak urutan perenggan dan hujah balas", "Ringkaskan idea setiap perenggan dalam satu ayat untuk mencari jurang logik. Bincangkan hujah balas secara adil jika diminta oleh rubrik. Sahkan fakta dan petikan sendiri serta patuhi peraturan penggunaan AI institusi anda."],
      ],
      example: [["Hujah", "Pernyataan umum: waktu mula sekolah penting", "Nyatakan sebab khusus untuk memulakan sekolah lebih lewat"], ["Bukti", "Bergantung pada pengalaman rakan sekelas", "Tambahkan sumber dipercayai tentang tidur dan pembelajaran"], ["Analisis", "Petikan tidak diikuti penjelasan", "Terangkan kaitan sumber dengan hujah"]],
    },
    "rubric-feedback-tool": {
      title: "Tukar Maklum Balas Rubrik kepada Pelan Pembaikan",
      description: "Pelajari cara membaca maklum balas kriteria dan menetapkan keutamaan pembaikan. Kukuhkan bukti, perincikan penjelasan dan perbaiki susunan draf.",
      intro: "Maklum balas paling berguna apabila ia membantu anda memperbaiki draf seterusnya. Gunakan penjelasan setiap kriteria dan keutamaan penambahbaikan RubriCheck untuk merancang apa, di mana dan bagaimana untuk menyunting.",
      sections: [
        ["Baca bersama kriteria penilaian", "Kenal pasti hujah atau perenggan yang dirujuk oleh komen seperti ‘bukti tidak mencukupi’. Bandingkan ungkapan rubrik asal dengan bukti dalam tugasan untuk menilai sama ada maklum balas itu sesuai."],
        ["Baiki masalah yang memberi kesan terbesar", "Utamakan kandungan yang hilang atau jurang hujah dalam kriteria dengan markah tinggi. Kemudian perhalus susunan, bahasa dan format. Anda tidak perlu menerima setiap cadangan tanpa pertimbangan."],
        ["Bandingkan bukti sebelum dan selepas pembaikan", "Gunakan rubrik dan mod yang sama ketika menilai semula. Selain markah, perhatikan sama ada bukti dan penjelasan baharu diiktiraf dalam maklum balas. Cadangan penulisan semula Pro ialah contoh rujukan yang masih memerlukan semakan dan suntingan."],
      ],
      example: [["Bukti kurang", "Semak hujah dan sumber berkaitan", "Tambah sumber dipercayai dan terangkan hubungannya"], ["Susunan kabur", "Ringkaskan tujuan setiap perenggan", "Susun semula mengikut logik dan tambah ayat penghubung"], ["Penjelasan terlalu abstrak", "Tandakan ungkapan yang sukar difahami", "Huraikan menggunakan contoh atau proses khusus"]],
    },
    "how-to-use-a-rubric-to-check-an-assignment": {
      title: "Langkah Menyemak Tugasan Sendiri Menggunakan Rubrik",
      description: "Ikuti langkah membaca rubrik, mencari bukti dalam draf dan menetapkan keutamaan pembaikan. Gunakan panduan semakan kendiri ini bersama maklum balas AI.",
      intro: "Rubrik ialah alat pemarkahan dan juga senarai semak untuk menyediakan tugasan. Gunakannya sejak peringkat draf supaya syarat yang belum dipenuhi dapat dikenal pasti lebih awal.",
      sections: [
        ["1. Baca kriteria dan tahap pencapaian", "Perhatikan markah setiap kriteria dan huraian tahap tinggi. Tukarkan istilah abstrak kepada tindakan yang boleh diperiksa. Contohnya, ‘kedalaman analisis’ boleh disemak melalui penjelasan sebab, makna dan batasan yang melangkaui ringkasan."],
        ["2. Cari bukti dalam draf", "Tandakan ayat atau perenggan yang anda fikir memenuhi setiap kriteria. Jika tiada bukti yang jelas, kandungan mungkin hilang atau belum dinyatakan dengan cukup baik. Bezakan apa yang anda ingin sampaikan dengan apa yang benar-benar ditulis."],
        ["3. Baiki dan semak dengan syarat yang sama", "Lengkapkan keperluan utama dahulu dan catat pembaikan anda. Bandingkan dengan maklum balas AI RubriCheck jika berguna, sambil mengutamakan rubrik asal serta arahan pengajar. Pastikan anda tahu sama ada versi yang dihantar sama dengan versi yang disemak oleh AI."],
      ],
      example: [["Baca kriteria", "‘Gunakan bukti yang boleh dipercayai’", "Semak arahan tugasan untuk mengenal pasti sumber sesuai"], ["Cari bukti", "Isi hanya menggunakan pengalaman peribadi", "Tandakan bahagian yang memerlukan sumber luar"], ["Semak pembaikan", "Sumber dan huraian telah ditambah", "Nilai semula kesesuaian bukti menggunakan rubrik sama"]],
    },
  },
};

export function localizeSeoGuide(page: SeoLandingPageContent, locale: Locale): SeoLandingPageContent {
  if (locale === "en") return page;
  if (locale === "hi" || locale === "ur" || locale === "vi" || locale === "zh") return localizeNewSeoGuide(page, locale);
  const copy = guides[locale][page.slug];
  if (!copy) return page;
  const t = (message: string) => translate(locale, message);
  return { ...page, title: copy.title, h1: copy.title, description: copy.description, intro: copy.intro,
    eyebrow: locale === "ko" ? "제출 전 과제 검토 가이드" : "Panduan semakan sebelum penghantaran",
    keywords: locale === "ko" ? ["과제 검토", "루브릭 채점", "AI 피드백", copy.title] : ["semakan tugasan", "rubrik pemarkahan", "maklum balas AI", copy.title],
    sections: copy.sections.map(([title, body]) => ({ title, body })),
    example: { title: locale === "ko" ? "초안 점검 예시" : "Contoh semakan draf", description: locale === "ko" ? "기준을 실제 수정 행동으로 바꾸는 방법입니다." : "Tukarkan kriteria kepada tindakan pembaikan yang khusus.", columns: locale === "ko" ? ["점검 대상", "확인할 내용", "다음 행동"] : ["Aspek", "Perkara untuk diperiksa", "Tindakan seterusnya"], rows: copy.example, note: locale === "ko" ? "이해를 돕기 위한 예시이며 공식 성적이나 점수 향상을 보장하지 않습니다." : "Contoh untuk penerangan sahaja; bukan markah rasmi atau jaminan peningkatan markah." },
    faqItems: HOME_FAQ_ITEMS.filter((_, index) => [0, 2, 3].includes(index)).map(item => ({ question: t(item.question), answer: t(item.answer) })),
    relatedLinks: HOME_INTERNAL_LINKS.filter(link => link.href !== page.path).map(link => ({ ...link, label: t(link.label), description: guides[locale][link.href.slice(1)]?.description ?? t(link.description) })),
    ctaLabel: locale === "ko" ? "내 과제 점검하기" : "Semak tugasan saya",
  };
}
