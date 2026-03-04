'use client';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

import {
  FileLoader,
  GroupBrowserTrigger,
  GroupBrowserPanel,
  VariableMenuTrigger,
  VariableMenuPanel,
  SearchBar,
  VariableDetails,
  VariableDataLoader,
  SliceTester,
  DimensionsCard,
  AttributesCard,
} from '@/components/loading/netcdf';
import { useViewerState } from '@/components/loading/netcdf/useViewerState';

const Viewer = () => {
  const {
    // Dataset
    tree,
    // Group / variable state
    currentGroupPath,
    variables,
    attributes,
    dimensions,
    selectedVariable,
    setSelectedVariable,
    setPendingVariableLoad,
    // Loading state
    isLoading,
    loadingVariable,
    error,
    url,
    setUrl,
    // Data controls
    sliceSize,
    setSliceSize,
    // Expand/collapse state
    expandedVariableInfo,
    setExpandedVariableInfo,
    expandedVariableAttrs,
    setExpandedVariableAttrs,
    expandedDimensions,
    setExpandedDimensions,
    expandedAttributes,
    setExpandedAttributes,
    expandedEnumDict,
    setExpandedEnumDict,
    // Menu states
    showGroupMenu,
    setShowGroupMenu,
    showVariableMenu,
    setShowVariableMenu,
    expandedGroups,
    // Search
    searchQuery,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    // Callbacks
    loadVariableInfo,
    loadVariableData,
    loadVariableSlice,
    handleFileSelect,
    handleUrlFetch,
    selectGroup,
    handleToggleGroupExpand,
    handleSearchInputChange,
    selectSearchResult,
    sliceSelections,
    setSliceSelections,
    expandedSliceTester,
    setExpandedSliceTester,
    sliceResult,
    sliceError,
    loadingSlice,
    handleRunSlice,
    // Derived
    breadcrumbs,
    groupSummary,
    datasetSummary,
  } = useViewerState();

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-0 space-y-3 sm:space-y-4">
      <FileLoader
        url={url}
        isLoading={isLoading}
        error={error}
        onUrlChange={setUrl}
        onFileSelect={handleFileSelect}
        onUrlFetch={handleUrlFetch}
      />

      {datasetSummary && (
        <div className="flex gap-2 justify-center text-xs text-muted-foreground flex-wrap">
          <span>{datasetSummary.totalGroups} groups</span>
          <span>•</span>
          <span>{datasetSummary.totalVariables} variables</span>
          <span>•</span>
          <span>{datasetSummary.totalDimensions} dimensions</span>
        </div>
      )}

      {tree && (
        <div className="space-y-3 sm:space-y-4">
          {/* Navigation Bar */}
          <Card className="border-0 py-4">
            <CardContent className="space-y-3 p-2 sm:p-3">

              {/* Row 1: trigger buttons + search */}
              <div className="flex gap-2 flex-wrap">
                <GroupBrowserTrigger
                  showGroupMenu={showGroupMenu}
                  onToggleMenu={() => {
                    setShowGroupMenu(!showGroupMenu);
                    if (!showGroupMenu) setShowVariableMenu(false);
                  }}
                />

                {Object.keys(variables).length > 0 && (
                  <VariableMenuTrigger
                    showVariableMenu={showVariableMenu}
                    onToggle={() => {
                      setShowVariableMenu(!showVariableMenu);
                      if (!showVariableMenu) setShowGroupMenu(false);
                    }}
                  />
                )}

                <SearchBar
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  showSearchResults={showSearchResults}
                  onQueryChange={handleSearchInputChange}
                  onSearch={() => handleSearchInputChange(searchQuery)}
                  onSelectResult={selectSearchResult}
                  onDismissResults={() => setShowSearchResults(false)}
                />
              </div>

              {/* Row 2: group summary badges + breadcrumbs */}
              <div className="flex flex-col gap-3">
                {groupSummary && (
                  <div className="flex gap-2 sm:gap-3 text-xs flex-wrap">
                    <Badge variant="outline" className="flex-shrink-0">
                      {groupSummary.variableCount} variables
                    </Badge>
                    <Badge variant="outline" className="flex-shrink-0">
                      {groupSummary.dimensionCount} dimensions
                    </Badge>
                    <Badge variant="outline" className="flex-shrink-0">
                      {groupSummary.attributeCount} attributes
                    </Badge>
                    {groupSummary.subgroupCount > 0 && (
                      <Badge variant="outline" className="flex-shrink-0">
                        {groupSummary.subgroupCount} subgroups
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
                    {breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={crumb.path}>
                        <button
                          onClick={() => selectGroup(crumb.path)}
                          className={`hover:text-foreground transition-colors cursor-pointer break-all ${
                            crumb.path === currentGroupPath
                              ? 'text-foreground font-semibold'
                              : ''
                          }`}
                        >
                          {crumb.name}
                        </button>
                        {idx < breadcrumbs.length - 1 && (
                          <ChevronRight className="h-3 w-3 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {selectedVariable && (
                    <Badge
                      className="text-xs h-5 max-w-full"
                      style={{ backgroundColor: '#644FF0', color: 'white' }}
                    >
                      <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{selectedVariable}</span>
                    </Badge>
                  )}
                </div>
              </div>

              {/* Row 3: dropdown panels — rendered below breadcrumbs */}
              {showGroupMenu && (
                <GroupBrowserPanel
                  tree={tree}
                  currentGroupPath={currentGroupPath}
                  expandedGroups={expandedGroups}
                  onToggleExpand={handleToggleGroupExpand}
                  onVariableClick={(varName, groupPath) => {
                    if (currentGroupPath !== groupPath) selectGroup(groupPath);
                    setPendingVariableLoad({ name: varName, groupPath });
                    setShowGroupMenu(false);
                  }}
                />
              )}

              {showVariableMenu && (
                <VariableMenuPanel
                  variables={variables}
                  selectedVariable={selectedVariable}
                  onSelect={(name) => {
                    setSelectedVariable(name);
                    if (!variables[name].info) loadVariableInfo(name);
                    setShowVariableMenu(false);
                  }}
                />
              )}

            </CardContent>
          </Card>

          {/* Variable Details */}
          {selectedVariable && variables[selectedVariable] && (
            <VariableDetails
              variable={variables[selectedVariable]}
              expandedVariableInfo={expandedVariableInfo}
              expandedVariableAttrs={expandedVariableAttrs}
              expandedEnumDict={expandedEnumDict}
              onToggleVariableInfo={() => setExpandedVariableInfo(!expandedVariableInfo)}
              onToggleVariableAttrs={() => setExpandedVariableAttrs(!expandedVariableAttrs)}
              onToggleEnumDict={() => setExpandedEnumDict(!expandedEnumDict)}
            />
          )}

          {/* Variable Data Loader */}
          {selectedVariable && variables[selectedVariable]?.info && (
            <VariableDataLoader
              variableName={selectedVariable}
              variable={variables[selectedVariable]}
              loadingVariable={loadingVariable}
              sliceSize={sliceSize}
              onSliceSizeChange={setSliceSize}
              onLoadSlice={loadVariableSlice}
              onLoadAll={loadVariableData}
            />
          )}

          {/* Slice Tester */}
          {selectedVariable && variables[selectedVariable]?.info && (
            <SliceTester
              info={variables[selectedVariable].info!}
              sliceSelections={sliceSelections}
              setSliceSelections={setSliceSelections}
              expandedSliceTester={expandedSliceTester}
              setExpandedSliceTester={setExpandedSliceTester}
              sliceResult={sliceResult}
              sliceError={sliceError}
              loadingSlice={loadingSlice}
              onRun={handleRunSlice}
            />
          )}

          <DimensionsCard
            dimensions={dimensions}
            expanded={expandedDimensions}
            onToggle={() => setExpandedDimensions(!expandedDimensions)}
          />

          <AttributesCard
            attributes={attributes}
            expanded={expandedAttributes}
            onToggle={() => setExpandedAttributes(!expandedAttributes)}
          />
        </div>
      )}
    </div>
  );
};

export default Viewer;