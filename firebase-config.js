// ==========================================
// firebase-config.js
// กรอก API Key ของ Firebase Project ที่นี่
// สร้างได้ฟรีที่ console.firebase.google.com
// ==========================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDYiKhC-sexToiiiYmq61oujoyH_Iom-fI",
  authDomain:        "espots-abbc5.firebaseapp.com",
  databaseURL:       "https://espots-abbc5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "espots-abbc5",
  storageBucket:     "espots-abbc5.firebasestorage.app",
  messagingSenderId: "444939922693",
  appId:             "1:444939922693:web:3825ebe2896c29aead1b6c"
};

// ตรวจสอบว่ากรอก config แล้วหรือยัง
function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
}

// ==========================================
// รายชื่อทีมและผู้เล่นที่ใช้แข่งจริง
// ==========================================
const CUSTOM_TEAM_NAMES = {
  A: [
    "4ปอขอเเก้", "กะจอกบอกเจ๋ง", "นะมอแจะ", "เมงุมิ", "Newgen", 
    "เวทใหญ่ที่ไม่ใช่ฝีมือ", "BURIRAM united", "เด้งดึ๋ง", 
    "มาล่ายูเอฟโอ", "ลาบหมูน้ำตก", "Fear of 69", "บทลงโทษของคนกินหมูV.2"
  ],
  B: [
    "แอบแม่มาแข่ง", "67", "ใจสั่งมา", "VOLCANIX", "มาม่วนๆ", 
    "หมวยใบอินเตอร์", "ปรสิตอากาศ", " Korok", "อย่าห้าวเดี๋ยวก้าวไม่ออก", 
    "หลอยไมโล", "มา4กลับ0", "เจ้แหม่มสั่งเสีย"
  ],
  C: [
    "ไม่หล่องเเต่เจ๋ง", "รักแฟนทีสุด", "หางบซื้อkfc", "กากหมูโรยกากเพรช", 
    "ใครอาบน้ำบ่อยสุด", "4/7 A", "ฟุตคอร์ด", "บ้านต้อมxศรีนวลล", 
    "ตุงตุง", "ชายหมี่สี่เกี๊ยว", "ลิงลพบุรี", "ลองตูงแลดปูด"
  ],
  D: [
    "Toxic Princess", "พวกติ๋ม888", "ซมซาน", "Oh oh", "闭月", 
    "Chinamon", "รถตู้", "โชกุนรวมน๊อต", "นิติสาขาFF", "นักเเข่งยาเสฟติด", 
    "ลูกจารย์จ้อด", "ก๋วยเตี๋ยวดูไบ#67"
  ],
  E: [
    "ท้ายปีศาจ", "ผีออเมาะ", "ตัวแสบแถบแท้งน้ำ", "สุกกี้แห้ง", 
    "เกมฟรีคนฟาย", "หิวเงินครับ", "ทนายจิตตรี", "4 สหาย", 
    "ท้ายสะง๊อง", "แปดตรวจ", "Red dragon", "ช็อกโกแลตนมXฟู้ดคอร์ด"
  ],
  F: [
    "ไม่รู้", "49", "ยิงกากแต่ปากดัง", "GG", "เล่น rov อยู่รอแปป", 
    "หมู", "ตี้น้องกี้888", "เเมะ", "ชายสี่", "มา4กลับ1", 
    "ศิวกรสั่งลุยย", "ทีม F12"
  ]
};

const DEFAULT_TEAMS_DATA = {};
['A', 'B', 'C', 'D', 'E', 'F'].forEach(g => {
  DEFAULT_TEAMS_DATA[g] = {};
  for (let i = 0; i < 12; i++) {
    const name = CUSTOM_TEAM_NAMES[g]?.[i] || `ทีม ${g}${i + 1}`;
    DEFAULT_TEAMS_DATA[g][i] = {
      name: name,
      players: [
        `${g}${i+1}_P1`,
        `${g}${i+1}_P2`,
        `${g}${i+1}_P3`,
        `${g}${i+1}_P4`
      ]
    };
  }
});

