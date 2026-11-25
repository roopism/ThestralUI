# Lucide base icon roster

Use Lucide 1.77.0 through public per-icon module paths. Retain the Lucide ISC notice and the supplied MIT notices for Feather-derived icons in the distributed package. Native requires the extra `react-native-svg` peer. The adapter must support semantic colors and sizes, an explicit label for meaningful icons, and selective mirroring of directional navigation and history icons. Check static colors in source and verify currentColor output on web and equivalent inherited token color on native. [Upstream license](https://github.com/lucide-icons/lucide/blob/main/LICENSE) · [Native individual imports](https://lucide.dev/guide/react-native/advanced/optimizations)

| Imported icons | Web minified / gzip B | Native minified / gzip B |
| --- | ---: | ---: |
| Search | 3,459 / 1,684 | 4,197 / 1,912 |
| Ten common icons | 5,603 / 2,457 | 6,346 / 2,704 |
| All 150 icons | 44,040 / 13,778 | 44,649 / 14,336 |

These are upstream JavaScript measurements from integrity-checked tarballs with esbuild 0.28.2, ES2020 modules, inline legal comments omitted, and gzip level 9. Metafiles included exactly 1, 10 and 150 glyph modules. React, React Native and the SVG renderer are external. Measure our wrappers, Metro/Hermes output and native binary increment separately before qualifying the package.

| Set | Base icon names |
| --- | --- |
| Navigation | House, Menu, PanelLeft, PanelRight, PanelsTopLeft, Route, Compass, MapPin, Landmark, ExternalLink, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoveHorizontal |
| Actions | Plus, Minus, X, Check, Search, Ellipsis, EllipsisVertical, Pencil, Copy, Clipboard, ClipboardCheck, Trash, Save, Undo2, Redo2 |
| Direction and layout | ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownLeft, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowDownWideNarrow, ListFilter, SlidersHorizontal, GripVertical, Maximize2, Minimize2 |
| Forms | SquareCheck, Square, Circle, CircleDot, ToggleLeft, ToggleRight, List, ListOrdered, CalendarDays, Clock, AlarmClock, Keyboard, Hash, Asterisk, EyeOff |
| Files | File, FileText, Files, Folder, FolderOpen, FolderPlus, Paperclip, Upload, Download, Image, Camera, ScanLine, BookOpen, NotebookText, Archive |
| Status | CircleCheck, CircleX, TriangleExclamationPoint, Info, CircleQuestionMark, LoaderCircle, Bell, BellOff, Flag, Star, Heart, ThumbsUp, Activity, ShieldCheck, WifiOff |
| People and communication | User, Users, UserRound, UserRoundPlus, Contact, Mail, Send, Inbox, MessageCircle, MessagesSquare, AtSign, Phone, Video, Share2, Link |
| Workspace and data | LayoutDashboard, Table2, Grid2x2, Columns3, Rows3, ChartColumn, ChartLine, ChartPie, Database, Server, HardDrive, BriefcaseBusiness, BuildingComplex, Layers, Network |
| Security and settings | Settings, Wrench, CircleUserRound, LockKeyhole, LockKeyholeOpen, KeyRound, FingerprintPattern, Shield, ShieldExclamationPoint, Eye, LogIn, LogOut, Sun, Moon, Monitor |
| Media and commerce | Play, Pause, Volume2, VolumeX, Mic, Headphones, AudioLines, Sparkles, Palette, ShoppingCart, ShoppingBag, CreditCard, Wallet, Receipt, Ticket |
