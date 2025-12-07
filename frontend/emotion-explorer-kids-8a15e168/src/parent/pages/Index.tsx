import { useState } from 'react';
import { Child } from '@parent/types';
import { Header } from '@parent/components/Header';
import { ChildSelector } from '@parent/components/ChildSelector';
import { Dashboard } from '@parent/components/Dashboard';
import { EmptyState } from '@parent/components/EmptyState';
import { ParentChat } from '@parent/components/ParentChat';
import { ChildOnboardingWizard } from '@parent/components/ChildOnboardingWizard';
import { ParentProfileSheet } from '@parent/components/ParentProfileSheet';
import { useChildren } from '@parent/hooks/useChildren';
import { useParentSummary } from '@parent/hooks/useParentSummary';
import { useToast } from '@parent/hooks/use-toast';
import { DEFAULT_TRAITS } from '@parent/hooks/useChildProfile';
import { getAvatarPreviewEmoji } from '@parent/utils/avatarPreview';
import { setStoredActiveChildId } from '@/lib/child';
import { useTaskStorage } from '@/hooks/useTaskStorage';

const Index = () => {
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [chatChild, setChatChild] = useState<Child | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const parentId = 1; // TODO: replace with authenticated parent id
  const { toast } = useToast();
  const { children, isLoading, addChild, refresh, deleteChild: removeChild } = useChildren(parentId);
  const { summary: parentSummary, isLoading: isSummaryLoading, refresh: refreshParentSummary } = useParentSummary(parentId, {
    fallbackChildren: children,
  });
  const { clearChildEntries } = useTaskStorage();

  const handleSelectChild = (child: Child) => {
    // Close chat if switching to a different child
    if (chatChild && chatChild.id !== child.id) {
      setIsChatOpen(false);
      setChatChild(null);
    }
    setSelectedChild(child);
    setStoredActiveChildId(child.id);
  };

  const handleAskAboutChild = (child: Child) => {
    // Select the child and open chat
    handleSelectChild(child);
    setChatChild(child);
    setIsChatOpen(true);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  const handleDeleteChild = async (child: Child) => {
    const confirmed = window.confirm(`Delete ${child.name}'s profile? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingChildId(child.id);
    try {
      await removeChild(child.id);
      clearChildEntries(child.id);
      toast({ title: 'Profile deleted', description: `${child.name}'s data has been removed.` });

      if (selectedChild?.id === child.id) {
        setSelectedChild(null);
        setStoredActiveChildId(null);
      }
      if (chatChild?.id === child.id) {
        setChatChild(null);
        setIsChatOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Could not delete profile',
        description: error instanceof Error ? error.message : 'Unexpected server error',
        variant: 'destructive',
      });
    } finally {
      setDeletingChildId(null);
      refresh();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        parentName={parentSummary?.name}
        childCount={parentSummary?.childCount ?? children.length}
        onProfileClick={() => setIsProfileOpen(true)}
      />
      
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 min-h-[calc(100vh-4rem)] border-r border-border bg-card/50 p-4 hidden md:block">
          <ChildSelector
            children={children}
            selectedChild={selectedChild}
            onSelectChild={handleSelectChild}
            onAskAboutChild={handleAskAboutChild}
          />
        </aside>

        {/* Mobile Child Selector */}
        <div className="md:hidden p-4 border-b border-border bg-card/50 w-full">
          <select
            className="w-full p-3 rounded-lg border border-border bg-background text-foreground"
            value={selectedChild?.id || ''}
            onChange={(e) => {
              const child = children.find(c => c.id === e.target.value);
              if (child) {
                handleSelectChild(child);
              } else {
                setSelectedChild(null);
                setStoredActiveChildId(null);
              }
            }}
          >
            <option value="">Select a child</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.avatar} {child.name} ({child.age} years old)
              </option>
            ))}
          </select>
          {selectedChild && (
            <button
              onClick={() => handleAskAboutChild(selectedChild)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm transition-colors duration-200"
            >
              Ask about {selectedChild.name}
            </button>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {isLoading ? (
            <EmptyState title="Loading children" description="Fetching your profiles…" />
          ) : children.length === 0 ? (
            <ChildOnboardingWizard
              parentId={parentId}
              onChildCreated={(payload) => {
                addChild(payload);
                const traits = payload.profile?.traits ?? DEFAULT_TRAITS;
                const mapped: Child = {
                  id: String(payload.child_id),
                  name: payload.name,
                  age: payload.age,
                  avatar: getAvatarPreviewEmoji(traits),
                  lastActivity: payload.created_at ?? new Date().toISOString(),
                  disability: payload.disability,
                  profile: payload.profile,
                };
                setSelectedChild(mapped);
                setStoredActiveChildId(mapped.id);
                toast({ title: 'Profile created', description: `${payload.name} is ready!` });
              }}
            />
          ) : selectedChild ? (
            <Dashboard
              child={selectedChild}
              onDeleteChild={handleDeleteChild}
              deletingChildId={deletingChildId}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {/* AI Chat */}
      {chatChild && (
        <ParentChat 
          child={chatChild} 
          isOpen={isChatOpen} 
          onClose={handleCloseChat}
          parentId={parentId}
        />
      )}

      <ParentProfileSheet
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        summary={parentSummary}
        isLoading={isSummaryLoading}
        onRefresh={refreshParentSummary}
      />
    </div>
  );
};

export default Index;
