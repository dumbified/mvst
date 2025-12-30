'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PlatformKey, DEFAULT_BOM_COSTS, PART_NUMBER_TO_PLATFORM } from "../lib/core/constants";
import { saveSettings, type AppSettings } from "../lib/storage/settingsStorage";
import { setCachedSettings, useSettings } from "../hooks/useSettings";

// Separate component for BOM cost input to prevent re-render issues
function BomCostInput({ 
  platform, 
  value, 
  onChange 
}: { 
  platform: string; 
  value: number; 
  onChange: (platform: string, value: string) => void;
}) {
  const [localValue, setLocalValue] = useState<string>(
    Number.isFinite(value) && value !== 0 ? value.toString() : ""
  );
  const [isFocused, setIsFocused] = useState(false);
  const prevValueRef = useRef<number>(value);

  // Update local value when prop changes externally (e.g., after refresh), but only if not focused
  // This prevents cursor jumps while the user is typing
  // Use setTimeout to defer state update and avoid setState in effect warning
  useEffect(() => {
    if (!isFocused && prevValueRef.current !== value) {
      prevValueRef.current = value;
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setLocalValue(Number.isFinite(value) && value !== 0 ? value.toString() : "");
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(platform, newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Validate on blur - if empty or invalid, set to 0
    if (localValue === "" || isNaN(parseFloat(localValue))) {
      setLocalValue("");
      onChange(platform, "0");
    } else {
      // Ensure the value is properly formatted
      const numValue = parseFloat(localValue);
      if (!Number.isNaN(numValue)) {
        setLocalValue(numValue.toString());
        prevValueRef.current = numValue;
      }
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0"
      step="0.01"
      className="w-full text-xs h-7 px-2 py-0.5"
    />
  );
}

export default function SettingsPage() {
  const [partNumberMappings, setPartNumberMappings] = useState<Array<{ partNumber: string; platform: PlatformKey }>>([]);
  const [bomCosts, setBomCosts] = useState<Record<string, number>>({});
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>('');
  const [googleSheetName, setGoogleSheetName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<number | null>(null);
  const hasRefreshedOnMount = useRef(false);
  
  // React Hook Form (used mainly for structure & submit handling)
  const form = useForm({
    defaultValues: {},
  });
  
  // Load settings using the hook
  const { loading, settings, refreshSettings } = useSettings();

  useEffect(() => {
    if (!loading && settings) {
      // Convert part number mappings to array format
      const mappings = Object.entries(settings.partNumberToPlatform).map(([partNumber, platform]) => ({
        partNumber,
        platform: platform as PlatformKey,
      }));
      setPartNumberMappings(mappings);
      setBomCosts(settings.bomCosts);
      setGoogleSheetsUrl(settings.googleSheetsUrl || '');
      setGoogleSheetName(settings.googleSheetName || '');
    } else if (!loading && !settings) {
      // Use defaults from constants
      const defaultMappings = Object.entries(PART_NUMBER_TO_PLATFORM).map(([partNumber, platform]) => ({
        partNumber,
        platform,
      }));
      setPartNumberMappings(defaultMappings);
      setBomCosts(DEFAULT_BOM_COSTS);
      setGoogleSheetsUrl('');
      setGoogleSheetName('');
    }
  }, [loading, settings]);

  // Refresh settings once when component mounts to ensure we have the latest from Supabase
  // This ensures that if settings were updated elsewhere (e.g., redownloaded from backup),
  // they will be immediately reflected
  useEffect(() => {
    // Wait for initial load to complete, then refresh once to get latest from Supabase
    if (!loading && !hasRefreshedOnMount.current) {
      hasRefreshedOnMount.current = true;
      refreshSettings();
    }
  }, [loading, refreshSettings]);

  const handleAddPartNumberMapping = () => {
    setPartNumberMappings([...partNumberMappings, { partNumber: "", platform: "TH3K" }]);
  };

  const handleRemovePartNumberMapping = (index: number) => {
    setMappingToDelete(index);
    setDeleteDialogOpen(true);
  };

  const confirmRemoveMapping = () => {
    if (mappingToDelete !== null) {
      setPartNumberMappings(partNumberMappings.filter((_, i) => i !== mappingToDelete));
      setDeleteDialogOpen(false);
      setMappingToDelete(null);
    }
  };

  const handleUpdatePartNumberMapping = (index: number, field: "partNumber" | "platform", value: string) => {
    const updated = [...partNumberMappings];
    updated[index] = { ...updated[index], [field]: value as PlatformKey };
    setPartNumberMappings(updated);
  };

  const handleUpdateBomCost = useCallback((platform: string, value: string) => {
    setBomCosts((prev) => {
      const updated = { ...prev };
      
      // Allow empty string for intermediate typing states
      if (value === "" || value === "-" || value === ".") {
        // Keep the platform key but don't update the value yet
        // This allows the user to type freely
        return prev;
      }

      // Try to parse the value
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue)) {
        updated[platform] = numValue;
      }
      
      return updated;
    });
  }, []);

  const handleAddBomPlatform = () => {
    // Create a temporary unique key; user can rename it in the input
    const existingKeys = Object.keys(bomCosts);
    let index = existingKeys.length + 1;
    let key = `NEW_PLATFORM_${index}`;
    while (existingKeys.includes(key)) {
      index += 1;
      key = `NEW_PLATFORM_${index}`;
    }

    setBomCosts({
      ...bomCosts,
      [key]: 0,
    });
  };

  const handleUpdateBomPlatformName = (oldPlatform: string, newPlatform: string) => {
    const trimmed = newPlatform.trim();
    setBomCosts((prev) => {
      const next = { ...prev };
      const value = next[oldPlatform];
      delete next[oldPlatform];
      if (trimmed) {
        next[trimmed] = value;
      }
      return next;
    });
  };

  const handleRemoveBomPlatform = (platform: string) => {
    setBomCosts((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Validate part number mappings
      const validMappings = partNumberMappings.filter((m) => m.partNumber.trim() !== "");
      const partNumberToPlatform: Record<string, PlatformKey> = {};
      
      for (const mapping of validMappings) {
        if (mapping.partNumber.trim()) {
          partNumberToPlatform[mapping.partNumber.trim()] = mapping.platform;
        }
      }

      const settings: AppSettings = {
        partNumberToPlatform,
        bomCosts,
        googleSheetsUrl: googleSheetsUrl.trim() || undefined,
        googleSheetName: googleSheetName.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      const success = await saveSettings(settings);
      
      if (success) {
        // Update the cache so other parts of the app can use the new settings immediately
        setCachedSettings(settings);
        // Refresh settings to ensure we have the latest from Supabase
        await refreshSettings();
        // Update mappings to remove empty ones
        setPartNumberMappings(validMappings);
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings. Please try again.");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("An error occurred while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white py-6 md:py-10">
        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 flex items-center justify-center h-64">
          <p className="text-neutral-500">Loading settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white py-6 md:py-10">
      <div className="max-w-6xl w-full mx-auto px-4 md:px-8 space-y-6">
        <header className="space-y-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="text-xl md:text-2xl font-semibold">Settings</h1>
          <Link href="/" className="underline text-blue-500">
            ← Back to Waterfall
          </Link>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(async () => { await handleSave(); })} className="space-y-6">
            {/* Part Number to Platform Mappings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Part Number to Platform</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPartNumberMapping}
                  className="border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-mono"
                >
                  Add
                </Button>
              </div>
              
              <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700">
                        <Label className="text-xs font-medium text-neutral-700">Part Number</Label>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700">
                        <Label className="text-xs font-medium text-neutral-700">Platform</Label>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700 w-20">
                        <span className="text-xs font-medium text-neutral-700">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {partNumberMappings.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                          No mappings yet. Click &quot;Add&quot; to create one.
                        </td>
                      </tr>
                    ) : (
                      partNumberMappings.map((mapping, index) => (
                        <tr key={index} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-2">
                            <Input
                              type="text"
                              value={mapping.partNumber}
                              onChange={(e) => handleUpdatePartNumberMapping(index, "partNumber", e.target.value)}
                              placeholder="e.g., 9300-ai001"
                              className="w-full text-xs h-7 px-2 py-0.5"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="text"
                              value={mapping.platform}
                              onChange={(e) => handleUpdatePartNumberMapping(index, "platform", e.target.value)}
                              placeholder="e.g., TH3K"
                              className="w-full text-xs h-7 px-2 py-0.5"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePartNumberMapping(index)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 text-xs h-auto py-1 px-2"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Google Sheets Configuration */}
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-medium">Google Sheets Configuration</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Configure the Google Sheets URL and sheet name for the forecast job number data. Leave empty to use default values.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="googleSheetsUrl" className="text-xs font-medium text-neutral-700">
                    Google Sheets URL
                  </Label>
                  <Input
                    id="googleSheetsUrl"
                    type="url"
                    value={googleSheetsUrl}
                    onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit"
                    className="text-xs h-8 px-2 py-1"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Paste the full Google Sheets URL or just the spreadsheet ID
                  </p>
                </div>
                
                <div className="flex flex-col gap-1">
                  <Label htmlFor="googleSheetName" className="text-xs font-medium text-neutral-700">
                    Sheet Name
                  </Label>
                  <Input
                    id="googleSheetName"
                    type="text"
                    value={googleSheetName}
                    onChange={(e) => setGoogleSheetName(e.target.value)}
                    placeholder="Main_Simulation"
                    className="text-xs h-8 px-2 py-1"
                  />
                  <p className="text-[11px] text-neutral-500">
                    The sheet that contains the forecast buckets
                  </p>
                </div>
              </div>
            </div>

            {/* BOM Costs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">BOM Costs</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBomPlatform}
                  className="border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-mono"
                >
                  Add
                </Button>
              </div>
              
              <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700">
                        <Label className="text-xs font-medium text-neutral-700">Platform</Label>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700">
                        <Label className="text-xs font-medium text-neutral-700">Cost</Label>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-700 w-20">
                        <span className="text-xs font-medium text-neutral-700">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(bomCosts).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                          No BOM costs defined yet. Click &quot;Add&quot; to create one.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(bomCosts).map(([platform, cost]) => (
                        <tr key={platform} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-2">
                            <Input
                              type="text"
                              value={platform}
                              onChange={(e) => handleUpdateBomPlatformName(platform, e.target.value)}
                              placeholder="e.g., TH3K"
                              className="w-full text-xs h-7 px-2 py-0.5"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <BomCostInput
                              platform={platform}
                              value={cost}
                              onChange={handleUpdateBomCost}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveBomPlatform(platform)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="w-fit mx-auto border border-blue-500 bg-blue-100 hover:bg-blue-100 text-blue-500 font-mono"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>

            <p className="text-[11px] text-neutral-500">
              Changes may take a short time to sync.
            </p>
          </form>
        </Form>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Mapping</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this part number to platform mapping? This action cannot be undone.
                {mappingToDelete !== null && partNumberMappings[mappingToDelete] && (
                  <span className="block mt-2 font-mono text-xs bg-neutral-100 px-2 py-1 rounded">
                    {partNumberMappings[mappingToDelete].partNumber} → {partNumberMappings[mappingToDelete].platform}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setMappingToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmRemoveMapping}
              >
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

