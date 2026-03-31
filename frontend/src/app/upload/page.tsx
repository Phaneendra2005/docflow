import UploadZone from "../../components/UploadZone";

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Upload Documents</h1>
        <p className="mt-1 text-sm text-slate-600">Upload one or more files. Progress will stream in real time and you can edit/finalize results.</p>
      </div>
      <UploadZone />
    </div>
  );
}

