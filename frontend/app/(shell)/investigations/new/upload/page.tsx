'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { uploadPcap } from '@/lib/api';

export default function UploadPCAPPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pickFile = (f: File | null) => {
    setError(null);
    if (f && !/\.(pcap|pcapng|cap)$/i.test(f.name)) {
      setError('Unsupported file type — upload a .pcap, .pcapng, or .cap file');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    if
