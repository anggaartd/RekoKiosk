import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, FlatList, useWindowDimensions } from 'react-native';
import StatusBar from './StatusBar';
import AppLauncherModule, { AppInfo } from '../utils/AppLauncherModule';
import { ManagedApp } from '../types/managedApps';

interface ExternalAppOverlayProps {
  /** Legacy single-app package (backward compat) */
  externalAppPackage: string | null;
  /** Managed apps list for multi-app home screen */
  managedApps?: ManagedApp[];
  /** External app sub-mode: single (classic) or multi (grid) */
  externalAppMode?: 'single' | 'multi';
  isAppLaunched: boolean;
  backButtonMode: string;
  /** Number of taps to return to settings (default 5) */
  returnTapCount?: number;
  /** Return mode: 'tap_anywhere' or 'button' (same as webview) */
  returnMode?: string;
  /** Detection timeout in ms for all taps (same as webview) */
  returnTapTimeout?: number;
  /** Whether the return button is visible (button mode only) */
  returnButtonVisible?: boolean;
  /** Button position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' */
  returnButtonPosition?: string;
  showStatusBar?: boolean;
  showBattery?: boolean;
  showWifi?: boolean;
  showBluetooth?: boolean;
  showVolume?: boolean;
  showTime?: boolean;
  statusBarTheme?: 'dark' | 'light';
  onReturnToApp: () => void;
  onGoToSettings: () => void;
  /** Called when user taps an app in the multi-app grid */
  onLaunchApp?: (packageName: string) => void;
}

const ExternalAppOverlay: React.FC<ExternalAppOverlayProps> = ({
  externalAppPackage,
  managedApps = [],
  externalAppMode = 'single',
  isAppLaunched,
  backButtonMode,
  returnTapCount = 5,
  returnMode = 'tap_anywhere',
  returnTapTimeout = 1500,
  returnButtonVisible = false,
  returnButtonPosition = 'bottom-right',
  showStatusBar = false,
  showBattery = true,
  showWifi = true,
  showBluetooth = true,
  showVolume = true,
  showTime = true,
  statusBarTheme = 'dark',
  onReturnToApp,
  onGoToSettings,
  onLaunchApp,
}) => {
  // Window dimensions must be reactive — `Dimensions.get('window')` is evaluated once
  // at module load, so tile widths captured in landscape stay wrong after rotation to portrait.
  const { width: windowWidth } = useWindowDimensions();
  const APP_GRID_NUM_COLUMNS = 4;
  const APP_GRID_HORIZONTAL_PADDING = 16;
  const APP_GRID_GAP = 8;
  const appTileWidth =
    (windowWidth - APP_GRID_HORIZONTAL_PADDING * 2 - APP_GRID_GAP * (APP_GRID_NUM_COLUMNS - 1)) /
    APP_GRID_NUM_COLUMNS;

  const [appLabels, setAppLabels] = useState<Record<string, string>>({});
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  
  // Return to settings — same mechanism as WebView (tap_anywhere / button)
  const gridTapCountRef = useRef<number>(0);
  const gridTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstTapXRef = useRef<number>(0);
  const firstTapYRef = useRef<number>(0);
  const TAP_PROXIMITY_RADIUS = 80;

  // tap_anywhere mode: N-tap with spatial proximity check (identical to WebView)
  const handleGridTouch = useCallback((event: any) => {
    if (returnMode !== 'tap_anywhere') return;

    const tapX = event.nativeEvent.pageX ?? 0;
    const tapY = event.nativeEvent.pageY ?? 0;

    if (gridTapCountRef.current === 0) {
      firstTapXRef.current = tapX;
      firstTapYRef.current = tapY;
      gridTapCountRef.current = 1;
    } else {
      const dx = tapX - firstTapXRef.current;
      const dy = tapY - firstTapYRef.current;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= TAP_PROXIMITY_RADIUS) {
        gridTapCountRef.current += 1;
      } else {
        // Too far — reset and start new sequence from this tap
        firstTapXRef.current = tapX;
        firstTapYRef.current = tapY;
        gridTapCountRef.current = 1;
      }
    }

    if (gridTapCountRef.current >= returnTapCount) {
      gridTapCountRef.current = 0;
      if (gridTapTimerRef.current) clearTimeout(gridTapTimerRef.current);
      onGoToSettings();
      return;
    }

    if (gridTapTimerRef.current) clearTimeout(gridTapTimerRef.current);
    gridTapTimerRef.current = setTimeout(() => {
      gridTapCountRef.current = 0;
    }, returnTapTimeout);
  }, [returnMode, returnTapCount, returnTapTimeout, onGoToSettings]);

  // button mode: N-tap on fixed corner button (identical to WebView)
  const handleGridButtonTap = useCallback(() => {
    gridTapCountRef.current++;

    if (gridTapCountRef.current >= returnTapCount) {
      gridTapCountRef.current = 0;
      if (gridTapTimerRef.current) clearTimeout(gridTapTimerRef.current);
      onGoToSettings();
      return;
    }

    if (gridTapTimerRef.current) clearTimeout(gridTapTimerRef.current);
    gridTapTimerRef.current = setTimeout(() => {
      gridTapCountRef.current = 0;
    }, returnTapTimeout);
  }, [returnTapCount, returnTapTimeout, onGoToSettings]);

  // Button position style (same positions as WebView / OverlayService)
  const buttonPositionStyle = useMemo(() => {
    switch (returnButtonPosition) {
      case 'top-left': return { top: 20, left: 20 };
      case 'top-right': return { top: 20, right: 20 };
      case 'bottom-left': return { bottom: 20, left: 20 };
      case 'bottom-right':
      default: return { bottom: 20, right: 20 };
    }
  }, [returnButtonPosition]);
  
  // Only show multi-app grid when explicitly in multi mode
  const homeScreenApps = externalAppMode === 'multi' ? managedApps.filter(app => app.showOnHomeScreen) : [];
  const isMultiAppMode = externalAppMode === 'multi' && homeScreenApps.length > 0;
  
  // Resolve app labels and icons for display
  useEffect(() => {
    const resolveLabelsAndIcons = async () => {
      const labels: Record<string, string> = {};
      const icons: Record<string, string> = {};
      const appsToResolve = isMultiAppMode ? homeScreenApps : 
        (externalAppPackage ? [{ packageName: externalAppPackage, displayName: '' }] : []);
      
      await Promise.all(appsToResolve.map(async (app) => {
        try {
          const label = await AppLauncherModule.getPackageLabel(app.packageName);
          labels[app.packageName] = label;
        } catch {
          labels[app.packageName] = ('displayName' in app && app.displayName) || app.packageName;
        }
        try {
          const icon = await AppLauncherModule.getAppIcon(app.packageName, 128);
          icons[app.packageName] = icon;
        } catch {
          // No icon available — fallback to initials
        }
      }));
      setAppLabels(labels);
      setAppIcons(icons);
    };
    resolveLabelsAndIcons();
  }, [homeScreenApps.length, externalAppPackage]);

  const handleAppPress = (packageName: string) => {
    if (onLaunchApp) {
      onLaunchApp(packageName);
    }
  };

  const renderAppIcon = ({ item }: { item: ManagedApp }) => {
    const label = appLabels[item.packageName] || item.displayName || item.packageName.split('.').pop() || '?';
    const initials = label.substring(0, 2).toUpperCase();
    const iconUri = appIcons[item.packageName];
    
    return (
      <TouchableOpacity
        style={[styles.appIconContainer, { width: appTileWidth }]}
        onPress={() => handleAppPress(item.packageName)}
        activeOpacity={0.7}
      >
        {iconUri ? (
          <Image
            source={{ uri: iconUri }}
            style={styles.appIconImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.appIconCircle}>
            <Text style={styles.appIconText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.appIconLabel} numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Multi-app mode: app is currently running — show empty view (Android shows the app)
  if (isMultiAppMode && isAppLaunched) {
    return <View style={styles.container} />;
  }

  // Clock state for multi-app home screen
  const [currentTime, setCurrentTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [wifiConnected, setWifiConnected] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch battery & wifi status
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const { SystemInfoModule } = require('react-native').NativeModules;
        if (SystemInfoModule && SystemInfoModule.getSystemInfo) {
          const info = await SystemInfoModule.getSystemInfo();
          if (info?.battery) {
            setBatteryLevel(info.battery.level);
            setIsCharging(info.battery.isCharging);
          }
          if (info?.wifi) {
            setWifiConnected(info.wifi.isConnected);
          }
        }
      } catch (e) {}
    };
    updateStatus();
    const statusInterval = setInterval(updateStatus, 10000);
    return () => clearInterval(statusInterval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const formatDay = (date: Date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  };

  // Battery icon component (portrait/vertical)
  const BatteryIcon = ({ level, charging }: { level: number; charging: boolean }) => {
    const fillHeight = Math.max(2, (level / 100) * 20);
    return (
      <View style={styles.batteryContainer}>
        {/* Battery cap */}
        <View style={styles.batteryCap} />
        {/* Battery body */}
        <View style={styles.batteryBody}>
          {/* Fill */}
          <View style={[styles.batteryFill, { height: fillHeight }]} />
          {/* Percentage text */}
          <Text style={styles.batteryText}>{level}</Text>
        </View>
      </View>
    );
  };

  // WiFi icon component
  const WifiIcon = ({ connected }: { connected: boolean }) => (
    <View style={styles.wifiContainer}>
      <View style={[styles.wifiArc3, { opacity: connected ? 1 : 0.3 }]} />
      <View style={[styles.wifiArc2, { opacity: connected ? 1 : 0.3 }]} />
      <View style={[styles.wifiArc1, { opacity: connected ? 1 : 0.3 }]} />
      <View style={[styles.wifiDot, { opacity: connected ? 1 : 0.3 }]} />
    </View>
  );

  // Multi-app mode: show app grid (home screen)
  if (isMultiAppMode && !isAppLaunched) {
    return (
      <View style={styles.multiAppContainer} onTouchStart={handleGridTouch}>
        {showStatusBar && (
          <StatusBar
            showBattery={showBattery}
            showWifi={showWifi}
            showBluetooth={showBluetooth}
            showVolume={showVolume}
            showTime={showTime}
            theme={statusBarTheme}
          />
        )}
        <View style={styles.multiAppHeader}>
          <View style={styles.multiAppHeaderLeft}>
            <Image
              source={require('../assets/images/logo_circle.png')}
              style={styles.miniLogo}
              resizeMode="contain"
            />
            <Text style={styles.multiAppTitle}>Rekosistem</Text>
          </View>
          <View style={styles.multiAppHeaderRight}>
            <WifiIcon connected={wifiConnected} />
            <BatteryIcon level={batteryLevel} charging={isCharging} />
            <View style={styles.multiAppHeaderSeparator} />
            <Text style={styles.multiAppClock}>{formatTime(currentTime)}</Text>
            <View style={styles.multiAppDateContainer}>
              <Text style={styles.multiAppDate}>{formatDate(currentTime)}</Text>
              <Text style={styles.multiAppDay}>{formatDay(currentTime)}</Text>
            </View>
          </View>
        </View>
        <FlatList
          data={homeScreenApps}
          renderItem={renderAppIcon}
          keyExtractor={item => item.packageName}
          numColumns={APP_GRID_NUM_COLUMNS}
          contentContainerStyle={styles.appGrid}
          columnWrapperStyle={styles.appGridRow}
        />
        
        {/* Watermark footer */}
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkText}>Created By ARTD</Text>
        </View>

        {/* Test mode warning */}
        {backButtonMode === 'test' && (
          <View style={styles.testModeBar}>
            <Text style={styles.testModeText}>🧪 Test Mode — Back button returns to settings</Text>
          </View>
        )}

        {/* Fixed button mode: floating return button (same as WebView) */}
        {returnMode === 'button' && (
          <TouchableOpacity
            style={[
              styles.floatingReturnButton,
              buttonPositionStyle,
              {
                opacity: returnButtonVisible ? 1 : 0,
                backgroundColor: returnButtonVisible ? '#2196F3' : 'transparent',
              },
            ]}
            activeOpacity={1}
            onPress={handleGridButtonTap}
          >
            <Text style={[styles.floatingReturnButtonText, { opacity: returnButtonVisible ? 1 : 0 }]}>↩</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Single-app mode or app is running: show original overlay
  return (
    <View style={styles.container}>
      {showStatusBar && (
        <StatusBar
          showBattery={showBattery}
          showWifi={showWifi}
          showBluetooth={showBluetooth}
          showVolume={showVolume}
          showTime={showTime}
          theme={statusBarTheme}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo/Icon Area */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/images/logo_circle.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>RekoKiosk</Text>
          <Text style={styles.subtitle}>External App Mode</Text>

          {/* Status Message */}
          <View style={styles.statusContainer}>
            <View style={styles.statusCard}>
              <Text style={styles.statusIcon}>
                {isAppLaunched ? '📱' : '⏳'}
              </Text>
              <Text style={styles.statusText}>
                {isAppLaunched
                  ? 'External application is running'
                  : 'Waiting for application...'}
              </Text>
              {externalAppPackage && (
                <Text style={styles.packageName}>{appLabels[externalAppPackage] || externalAppPackage}</Text>
              )}
            </View>
          </View>

          {/* Mode Info - Only show in test mode */}
          {backButtonMode === 'test' && (
            <View style={styles.warningContainer}>
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>🧪</Text>
                <Text style={styles.warningTitle}>Test Mode Active</Text>
                <Text style={styles.warningText}>
                  You can use the Android back button to return to RekoKiosk.
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onReturnToApp}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                ↩ Return to Application
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onGoToSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>⚙ Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              💡 Tip: While in the external app, tap 5× on the secret button to return here (position configurable)
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0066cc',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
  },
  statusContainer: {
    width: '100%',
    marginBottom: 32,
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  packageName: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 4,
  },
  warningContainer: {
    width: '100%',
    marginBottom: 24,
  },
  warningCard: {
    backgroundColor: '#FFA726',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#0066cc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  hintContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Multi-app home screen styles
  multiAppContainer: {
    flex: 1,
    backgroundColor: '#e8f0fe',
  },
  multiAppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1a3a7a',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
  },
  multiAppHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  multiAppHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  multiAppHeaderSeparator: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  // Battery styles (portrait/vertical)
  batteryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryCap: {
    width: 8,
    height: 3,
    backgroundColor: '#fff',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  batteryBody: {
    width: 16,
    height: 26,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  batteryFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
  batteryText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#fff',
    zIndex: 1,
    marginBottom: 2,
  },
  // WiFi styles
  wifiContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  wifiDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  wifiArc1: {
    width: 10,
    height: 5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#fff',
    position: 'absolute',
    bottom: 6,
  },
  wifiArc2: {
    width: 16,
    height: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#fff',
    position: 'absolute',
    bottom: 9,
  },
  wifiArc3: {
    width: 22,
    height: 11,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#fff',
    position: 'absolute',
    bottom: 12,
  },
  // Watermark
  watermarkContainer: {
    position: 'absolute',
    bottom: 8,
    right: 16,
  },
  watermarkText: {
    fontSize: 10,
    color: 'rgba(0, 0, 0, 0.12)',
    fontWeight: '300',
    fontStyle: 'italic',
  },
  multiAppClock: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  multiAppDateContainer: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.4)',
    paddingLeft: 12,
  },
  multiAppDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  multiAppDay: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  miniLogo: {
    width: 40,
    height: 40,
  },
  multiAppTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  appGrid: {
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  appGridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  appIconContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  appIconImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 8,
  },
  appIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 58, 122, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 58, 122, 0.2)',
    marginBottom: 8,
  },
  appIconText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a3a7a',
  },
  appIconLabel: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    lineHeight: 15,
    fontWeight: '500',
  },
  testModeBar: {
    backgroundColor: '#FFA726',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  testModeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  floatingReturnButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  floatingReturnButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ExternalAppOverlay;
