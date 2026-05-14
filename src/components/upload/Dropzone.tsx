import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload as UploadIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShapefileUpload } from '@/hooks/useShapefileUpload';

export interface DropzoneProps {
  /**
   * Optional override — when provided, replaces the default shapefile pipeline.
   * The dropzone still handles its own visual state.
   */
  onFiles?: (files: FileList) => void;
  className?: string;
}

const ACCEPTED = '.zip,.shp,.dbf,.shx,.prj,.cpg,.geojson,.json';

/**
 * Drag-and-drop / click target that ingests a shapefile bundle (single `.zip`
 * or the loose `.shp` + `.dbf` siblings) and routes it through
 * `useShapefileUpload` — which parses with shpjs and stores the WGS84 GeoJSON
 * in `useUploadStore` for the map components to render.
 */
export function Dropzone({ onFiles, className }: DropzoneProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { ingestFiles, isParsing } = useShapefileUpload();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (onFiles) {
        onFiles(files);
        return;
      }
      void ingestFiles(files);
    },
    [ingestFiles, onFiles]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset so picking the same file twice still triggers `change`.
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openPicker();
      }}
      aria-busy={isParsing}
      className={cn(
        'cursor-pointer rounded-[10px] border-[1.5px] border-dashed px-3 py-4 text-center transition-all',
        isDragOver
          ? 'border-brand-teal bg-brand-teal/10'
          : 'border-brand-teal/35 hover:border-brand-teal',
        'bg-[radial-gradient(circle_at_50%_0%,rgba(76,175,80,0.12),transparent_70%)] hover:bg-[radial-gradient(circle_at_50%_0%,rgba(76,175,80,0.2),transparent_70%)]',
        isParsing && 'pointer-events-none opacity-80',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
      <div className="mx-auto mb-2 grid h-[42px] w-[42px] place-items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
        {isParsing ? <Loader2 size={20} className="animate-spin" /> : <UploadIcon size={20} />}
      </div>
      <div className="mb-1 text-[13px] font-medium text-text">
        {isParsing ? 'מעבד את הקובץ...' : 'גרור קבצים לכאן או לחץ לבחירה'}
      </div>
      <div className="font-mono text-[11px] text-text-faint">
        .zip / .geojson / .shp + .dbf (+ .prj)
      </div>
    </div>
  );
}
