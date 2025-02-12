"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function CheckInCard() {
  const [lastCheckIn, setLastCheckIn] = useState<Date>(() => {
    const saved = localStorage.getItem('dailyGlideData');
    return saved ? new Date(JSON.parse(saved).lastCheckIn) : new Date(0);
  });
  const [points, setPoints] = useState(() => {
    const saved = localStorage.getItem('dailyGlideData');
    return saved ? JSON.parse(saved).points : 0;
  });
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem('dailyGlideData');
    return saved ? JSON.parse(saved).streak : 0;
  });

  const checkIn = useCallback(() => {
    const now = new Date();
    const timeDiff = now.getTime() - lastCheckIn.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    let newStreak = streak;
    if (hoursDiff > STREAK_RESET_HOURS) {
      newStreak = 0;
    }

    const newPoints = points + DAILY_POINTS;
    const newStreakValue = newStreak + 1;
    
    const data = {
      lastCheckIn: now.toISOString(),
      points: newPoints,
      streak: newStreakValue
    };

    localStorage.setItem('dailyGlideData', JSON.stringify(data));
    
    setLastCheckIn(now);
    setPoints(newPoints);
    setStreak(newStreakValue);
  }, [lastCheckIn, points, streak]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Check-In</CardTitle>
        <CardDescription>
          {streak > 0 ? `${streak} day streak!` : "Start your daily streak!"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <div>
            <Label className="text-sm">Points</Label>
            <p className="text-2xl font-bold">{points}</p>
          </div>
          <div>
            <Label className="text-sm">Current Streak</Label>
            <p className="text-2xl font-bold">{streak} days</p>
          </div>
        </div>

        <div className="text-center">
          <Label className="text-sm">Last Check-In</Label>
          <p className="text-lg">
            {lastCheckIn.getTime() > 0 ? 
              formatTime(lastCheckIn) : "Never"}
          </p>
        </div>

        <button
          onClick={checkIn}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          disabled={new Date().getTime() - lastCheckIn.getTime() < 1000 * 60 * 60 * 24}
        >
          {new Date().getTime() - lastCheckIn.getTime() < 1000 * 60 * 60 * 24 ?
            "Checked In Today!" : "Check In Now"}
        </button>
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Check in daily to maintain your streak and earn points!
        </p>
        <CheckInCard />
      </div>
    </div>
  );
}
