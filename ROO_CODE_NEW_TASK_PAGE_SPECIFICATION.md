# Roo Code "New Task" Page - Complete UI & Interaction Specification

## Overview

The "New Task" page in Roo Code is accessed by clicking the "New Task" button in the top toolbar. This triggers the `plusButtonClicked` command which clears the current task stack, refreshes the workspace, switches to the "chat" tab, and focuses the input field.

## Top Toolbar Button Layout

From left to right:

1. **"New Task"** (`plusButtonClicked`) - Icon: `$(add)`
2. **"Marketplace"** (`marketplaceButtonClicked`) - Icon: `$(extensions)`
3. **"Settings"** (`settingsButtonClicked`) - Icon: `$(gear)`
4. **"Cloud"** (`cloudButtonClicked`) - Icon: `$(cloud)`
5. **"VisionSync"** (`visionSyncButtonClicked`) - Icon: `$(device-camera-video)`
6. **"More Actions"** (overflow menu) - Contains History and other functions

## Page Structure & Components

### 1. Welcome Area (When No Active Task)

#### Version Indicator

- **Location**: Top-right corner
- **Function**: Shows current version, clickable to view changelog
- **Style**: Small, unobtrusive badge

#### Roo Logo (RooHero Component)

- **Location**: Center of welcome area
- **Design**: SVG logo with theme-aware coloring
- **Size**: Responsive, scales with container

#### Telemetry Banner

- **Condition**: Shows on first use when telemetry setting is "unset"
- **Content**: Data collection consent request
- **Actions**: Accept/Decline buttons

#### Welcome Tips (RooTips Component)

- **Content**:
    - Documentation link with text "Learn more in the docs"
    - Feature highlight cards:
        - 🏗️ **Customizable Modes**: Links to mode usage documentation
        - 📋 **Boomerang Tasks**: Links to task management features
- **Layout**: Centered, max-width 380px

#### Recent Tasks Preview (HistoryPreview Component)

- **Trigger**: Expandable section with eye icon
- **Content**: List of recent tasks when expanded
- **Condition**: Only shows if task history exists
- **Interaction**: Click to toggle expand/collapse

### 2. Auto-Approval Menu (AutoApproveMenu Component)

#### Master Toggle

- **Function**: Enable/disable auto-approval system
- **Visual**: Checkbox with label "Auto-approve actions"
- **Behavior**: Controls visibility of detailed options

#### Detailed Options (Expandable)

When expanded, shows checkboxes for:

- ✅ **Read-only operations**: Auto-approve file reading
- ✅ **Write operations**: Auto-approve file modifications
- ✅ **Command execution**: Auto-approve terminal commands
- ✅ **Browser actions**: Auto-approve web interactions
- ✅ **MCP tools**: Auto-approve MCP server calls
- ✅ **Mode switching**: Auto-approve mode changes
- ✅ **Subtask creation**: Auto-approve creating subtasks
- ✅ **Resubmission**: Auto-approve retry after failures
- ✅ **Follow-up questions**: Auto-approve follow-up queries
- ✅ **TODO updates**: Auto-approve task list modifications

#### Smart State Management

- Automatically enables master toggle when first option is selected
- Automatically disables master toggle when all options are deselected
- Persists settings across sessions

### 3. Task Input Area (ChatTextArea Component)

#### Main Text Input

- **Type**: Multi-line textarea with auto-resize
- **Height**: 3-8 lines visible, auto-adjusts based on content
- **Placeholder**: Dynamic placeholder text
- **Features**:
    - Syntax highlighting for mentions and commands
    - Auto-complete for file paths and commands
    - Prompt history navigation (up/down arrows)

#### Advanced Input Features

- **@ Mentions**: `@filename` to reference workspace files
    - Shows dropdown with file suggestions
    - Supports path completion
    - Converts to proper mention format
- **Slash Commands**: `/command` for quick actions
    - Shows command palette popup
    - Supports custom commands
    - Auto-completion available
- **Context Menu**: Right-click for additional options
- **Drag & Drop**: Support for file and image dropping

#### Keyboard Shortcuts

- `Enter`: Send message
- `Shift + Enter`: New line
- `Cmd/Ctrl + .`: Switch to next mode
- `Cmd/Ctrl + Shift + .`: Switch to previous mode
- `Up/Down Arrows`: Navigate prompt history

#### Bottom-Right Button Group

- **✨ Enhance Prompt Button** (Optional feature):
    - Function: AI-powered input optimization
    - Visual: Wand/sparkles icon
    - State: Shows spinner when processing
- **📤 Send Button**:
    - Function: Submit task request
    - Visual: Send/arrow icon
    - State: Always visible, disabled when input empty

### 4. Bottom Toolbar

#### Left Side Selectors

##### Mode Selector (ModeSelector Component)

- **Display**: Dropdown showing current mode name
- **Icon**: Chevron up/down indicating dropdown state
- **Search**: Available when >6 modes (search threshold)
- **Content**:
    - Built-in modes: 🏗️ Architect, 💻 Code, ❓ Ask, 🪲 Debug
    - Custom modes: User-defined and project-specific modes
    - Mode descriptions shown in dropdown
- **Keyboard**: Shortcuts displayed in tooltip
- **Footer Actions**:
    - Marketplace button (extensions icon)
    - Settings button (gear icon)

##### API Configuration Selector (ApiConfigSelector Component)

- **Display**: Shows current provider/model name
- **Function**: Select AI provider and model configuration
- **Features**:
    - Pinned configurations for quick access
    - Configuration metadata display
    - Disabled state when sending messages
- **Visual**: Ellipsis overflow for long names

#### Right Side Tool Buttons

##### TTS Control (Conditional)

- **Condition**: Only visible when TTS is playing
- **Icon**: Volume X (mute icon)
- **Function**: Stop text-to-speech playback
- **Tooltip**: "Stop TTS"

##### Slash Commands Popover (SlashCommandsPopover Component)

- **Icon**: Forward slash (/)
- **Function**: Quick access to command palette
- **Content**: List of available commands
- **Interaction**: Click to open, click command to insert

##### Indexing Status Badge (IndexingStatusBadge Component)

- **Function**: Shows codebase indexing progress
- **States**: Idle, indexing, complete, error
- **Visual**: Progress indicator or status icon
- **Tooltip**: Current indexing status

##### Add Images Button

- **Icon**: Image/picture icon
- **Function**: Open file picker for image selection
- **Limit**: Maximum 20 images (Anthropic limit)
- **States**: Enabled/disabled based on model capabilities
- **Tooltip**: "Add images"

### 5. Image Upload System

#### Image Selection

- **Methods**:
    - Click "Add Images" button → file picker
    - Drag & drop images onto input area
    - Paste images from clipboard
- **Formats**: PNG, JPG, GIF, WebP, etc.
- **Limit**: 20 images maximum per message

#### Thumbnail Preview (Thumbnails Component)

- **Location**: Above input area when images selected
- **Display**: Grid of image thumbnails
- **Features**:
    - Hover effects for better UX
    - Delete button (X) on each thumbnail
    - Responsive grid layout
- **Interaction**: Click X to remove individual images

## Interaction Flow

### Complete Task Creation Flow

```
1. Click "New Task" button in toolbar
2. System clears current task stack
3. System refreshes workspace context
4. Page switches to "chat" tab (ChatView component)
5. Input field automatically receives focus
6. User enters task description
7. User selects mode (optional, defaults to current)
8. User selects API configuration (optional, uses current)
9. User uploads images (optional, up to 20)
10. User clicks send or presses Enter
11. System creates new task with provided parameters
```

### Smart Behaviors

- **Auto-focus**: Input field focuses when page loads
- **Auto-save**: Draft inputs saved locally
- **Smart suggestions**: Context-aware completions
- **Error handling**: Validation and user feedback
- **Responsive design**: Adapts to window size changes

## Technical Implementation Details

### Component Architecture

- **ChatView.tsx**: Main container component
- **ChatTextArea.tsx**: Input area with advanced features
- **ModeSelector.tsx**: Mode selection dropdown
- **ApiConfigSelector.tsx**: API configuration selector
- **AutoApproveMenu.tsx**: Auto-approval settings
- **RooHero.tsx**: Welcome area logo
- **RooTips.tsx**: Feature tips and documentation links
- **Thumbnails.tsx**: Image preview component

### State Management

- **ExtensionStateContext**: Global application state
- **Local component state**: UI-specific state
- **Message passing**: Communication with VSCode extension
- **Persistence**: Settings and preferences storage

### Styling System

- **Tailwind CSS**: Atomic CSS framework
- **VSCode theme variables**: Consistent with editor theme
- **Responsive design**: Mobile and desktop friendly
- **Animations**: Smooth transitions and micro-interactions

### Accessibility Features

- **Keyboard navigation**: Full keyboard support
- **Screen reader support**: ARIA labels and descriptions
- **Focus management**: Proper focus handling
- **High contrast**: Theme-aware styling

## Detailed UI Specifications

### Visual Design Standards

- **Color Scheme**: Uses VSCode theme variables for consistency
- **Typography**: VSCode font family and sizing
- **Spacing**: Consistent padding and margins using Tailwind scale
- **Borders**: Subtle borders with theme-aware colors
- **Shadows**: Minimal shadows for depth perception

### Animation & Transitions

- **Duration**: 150-300ms for most transitions
- **Easing**: CSS ease-in-out for smooth animations
- **Hover Effects**: Opacity and background color changes
- **Loading States**: Spinners and progress indicators
- **Micro-interactions**: Button press feedback, input focus rings

### Responsive Behavior

- **Breakpoints**: Adapts to different window sizes
- **Compact Mode**: Optimized layout for narrow windows
- **Touch Support**: Touch-friendly button sizes and interactions
- **Mobile Considerations**: Though primarily desktop-focused

### Error Handling & Validation

- **Input Validation**: Real-time validation of user inputs
- **Error Messages**: Clear, actionable error descriptions
- **Recovery Options**: Retry mechanisms and fallback behaviors
- **Network Issues**: Graceful handling of connectivity problems

### Performance Optimizations

- **Virtual Scrolling**: For large message lists (Virtuoso component)
- **Debounced Inputs**: Prevents excessive API calls
- **Lazy Loading**: Components loaded on demand
- **Memory Management**: Proper cleanup of event listeners

### Internationalization (i18n)

- **Multi-language Support**: React-i18next integration
- **Dynamic Text**: All UI text externalized to translation files
- **RTL Support**: Right-to-left language compatibility
- **Locale-aware Formatting**: Dates, numbers, and currencies

## Integration Points

### VSCode Extension Communication

- **Message Passing**: Bidirectional communication via postMessage
- **Event Handling**: Responds to extension events and commands
- **State Synchronization**: Keeps UI in sync with extension state
- **Command Execution**: Triggers VSCode commands from UI

### File System Integration

- **Workspace Awareness**: Understands current workspace context
- **File Watching**: Responds to file system changes
- **Path Resolution**: Handles relative and absolute paths
- **Permission Handling**: Respects file system permissions

### AI Provider Integration

- **Multiple Providers**: Supports various AI services
- **Configuration Management**: Handles API keys and settings
- **Model Selection**: Dynamic model availability
- **Usage Tracking**: Monitors token usage and costs
