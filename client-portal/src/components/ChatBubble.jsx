import { User, Bot } from "lucide-react";

const ChatBubble = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser
          ? "bg-indigo-500"
          : "bg-gradient-to-br from-indigo-500 to-purple-600"
        }`}
      >
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot  size={14} className="text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm"
          : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm"
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-xs mt-1.5 ${isUser ? "text-white/60" : "text-gray-400"}`}>
          {message.createdAt
            ? new Date(message.createdAt.seconds * 1000).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit",
              })
            : "Just now"}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
