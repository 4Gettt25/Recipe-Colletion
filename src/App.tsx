import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecipes } from '@/hooks/useRecipes';
import type { Recipe, RecipeFormData } from '@/types/recipe';
import { RecipeList } from '@/components/RecipeList';
import { RecipeDetail } from '@/components/RecipeDetail';
import { RecipeForm } from '@/components/RecipeForm';
import { SettingsSheet } from '@/components/SettingsSheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isNative, getServerUrl } from '@/lib/api';

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <RecipeApp />
    </>
  );
}

function RecipeApp() {
  const { t } = useTranslation();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const {
    recipes,
    isLoaded,
    connectionError,
    localRecipeCount,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    updateRating,
    toggleFavourite,
    syncToServer,
    saveToPhone,
  } = useRecipes();

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedRecipe(null);
    setView('list');
  };

  const handleAddRecipe = () => {
    setEditingRecipe(null);
    setIsFormOpen(true);
  };

  const handleEditRecipe = () => {
    if (selectedRecipe) {
      setEditingRecipe(selectedRecipe);
      setIsFormOpen(true);
    }
  };

  const handleSaveRecipe = async (formData: RecipeFormData) => {
    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id, formData);
        toast.success(t('toast.recipeUpdated'));
        if (selectedRecipe?.id === editingRecipe.id) {
          setSelectedRecipe({ ...selectedRecipe, ...formData });
        }
      } else {
        await addRecipe(formData);
        toast.success(t('toast.recipeAdded'));
      }
      setIsFormOpen(false);
      setEditingRecipe(null);
    } catch (err) {
      toast.error(t('toast.recipeSaveFailed', { error: (err as Error).message }));
    }
  };

  const handleDeleteRecipe = () => {
    if (selectedRecipe) {
      deleteRecipe(selectedRecipe.id);
      toast.success(t('toast.recipeDeleted'));
      setSelectedRecipe(null);
      setView('list');
    }
  };

  const handleRateRecipe = (rating: number) => {
    if (selectedRecipe) {
      updateRating(selectedRecipe.id, rating);
      toast.success(t('toast.ratingSaved'));
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">{t('app.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1
              onClick={handleBackToList}
              className="text-xl font-bold text-orange-600 cursor-pointer hover:text-orange-700 transition-colors"
            >
              {t('app.title')}
            </h1>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                {t('app.recipeCount', { count: recipes.length })}
              </div>
              <div className="relative">
                <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
                {isNative() && localRecipeCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {connectionError && isNative() && getServerUrl() && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-yellow-800">{t('app.errorBanner', { error: connectionError })}</p>
          <Button size="sm" variant="ghost" className="text-yellow-800 h-6 text-xs" onClick={() => setShowSettings(true)}>
            {t('app.settings')}
          </Button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === 'list' && (
          <RecipeList
            recipes={recipes}
            onAddRecipe={handleAddRecipe}
            onSelectRecipe={handleSelectRecipe}
            onToggleFavourite={toggleFavourite}
            onSaveToPhone={(id) => { saveToPhone(id); toast.success(t('toast.savedToPhone')); }}
          />
        )}

        {view === 'detail' && selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onBack={handleBackToList}
            onEdit={handleEditRecipe}
            onDelete={handleDeleteRecipe}
            onRate={handleRateRecipe}
          />
        )}
      </main>

      <SettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        localRecipeCount={localRecipeCount}
        onSyncToServer={syncToServer}
        connectionError={connectionError}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? t('app.editRecipe') : t('app.addNewRecipe')}
            </DialogTitle>
          </DialogHeader>
          <RecipeForm
            initialData={editingRecipe || undefined}
            onSubmit={handleSaveRecipe}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingRecipe(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
