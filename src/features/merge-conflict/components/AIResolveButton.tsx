import { Sparkle, Warning } from '@phosphor-icons/react';
import { useMergeConflictStore } from '../../../stores/merge-conflict-store';
import { aiResolveConflict } from '../../../lib/tauri';
import { Button } from '../../../components/ui/Button';

export function AIResolveButton() {
  const {
    currentFile,
    notes,
    isAIResolving,
    aiError,
    setAIResolving,
    setAIError,
    setResolvedContent,
    setAIExplanation,
  } = useMergeConflictStore();

  const handleAIResolve = async () => {
    if (!currentFile || isAIResolving) return;

    setAIResolving(true);
    setAIError(null);

    try {
      const response = await aiResolveConflict(
        currentFile.filePath,
        currentFile.oursFull,
        currentFile.theirsFull,
        notes || undefined
      );

      // Set the resolved content (user can still edit before saving)
      setResolvedContent(currentFile.filePath, response.resolved);

      // Store the AI's explanation
      if (response.explanation) {
        setAIExplanation(currentFile.filePath, response.explanation);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAIError(errorMessage);
    } finally {
      setAIResolving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        size="md"
        onClick={handleAIResolve}
        disabled={!currentFile}
        loading={isAIResolving}
        leftIcon={!isAIResolving ? <Sparkle size={14} weight="fill" /> : undefined}
        className="bg-accent-purple hover:bg-accent-purple/90"
      >
        {isAIResolving ? 'Resolving...' : 'AI Resolve'}
      </Button>

      {aiError && (
        <div className="flex items-start gap-2 px-3 py-2 bg-accent-red/10 border border-accent-red/30 rounded text-xs text-accent-red">
          <Warning size={14} weight="fill" className="shrink-0 mt-0.5" />
          <span className="break-words">{aiError}</span>
        </div>
      )}
    </div>
  );
}
